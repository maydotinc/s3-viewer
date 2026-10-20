import {
   ApiError,
   api,
   cancelledError,
   errorMessage,
   isAborted,
   objectsPath,
   serverPath,
} from "@/lib/api";
import type { BucketTarget } from "@/lib/types";
import { joinSentences } from "@/lib/utils/format";
import { isFolderRefusal } from "@/lib/utils/folder-refusal";
import { reportBatchResult } from "@/lib/utils/s3/batch";
import { checkUploadConflicts } from "@/lib/utils/s3/upload-preflight";
import {
   OVERLAP_ERROR,
   destinationKey,
   prefixesOverlap,
} from "@/lib/utils/s3/keys";
import {
   NEVER_ABORTED,
   RATE_LIMIT_RETRY,
   retryWithBackoff,
} from "@/lib/utils/retry";
import { acceptKeysPage, fetchKeysPage } from "@/lib/utils/s3/walk-prefix";
import {
   TRANSFERS_PATH,
   ErrorCode,
   mapLimit,
   objectKeySchema,
   type S3ObjectUploaded,
} from "@s3-viewer/types";
import { forgetObjects } from "./invalidate";
import useObjectMutation from "./object-mutation";

const TRANSFER_CONCURRENCY = 2;

type TransferItem = {
   key: string;
   expectedETag: string | null;
   size?: number | null;
};

type TransferSource =
   | { folderKey: string }
   | { objects: TransferItem[]; prefix: string };

type TransferDestination = {
   serverId: string;
   bucketName: string;
   prefix: string;
};

type TransferFailure = {
   key: string;
   message: string;
   retryable: boolean;
};

type TransferSummary = {
   transferred: number;
   skipped: number;
   bytes: number;
   failed: TransferFailure[];
   listingError: string | null;
   remaining: boolean;
};

type TransferProgress = { done: number; skipped: number; bytes: number };

type TransferInput = BucketTarget & {
   source: TransferSource;
   destination: TransferDestination;
   overwrite: boolean;
   signal?: AbortSignal;
   onProgress?: (progress: TransferProgress) => void;
   operation?: TransferOperation;
};

type PlannedTransfer = { item: TransferItem; objectKey: string };
type TransferEntry = PlannedTransfer & {
   status: "pending" | "done" | "failed";
};
type TransferOperation = {
   scope: string;
   summary: TransferSummary;
   page: TransferEntry[] | null;
   nextToken: string | undefined;
   tokens: Set<string>;
   exhausted: boolean;
   running: boolean;
};

const operationScope = (input: TransferInput) =>
   JSON.stringify([
      input.userId,
      input.serverId,
      input.bucketName,
      input.source,
      input.destination,
      input.overwrite,
   ]);

const createTransferOperation = (input: TransferInput): TransferOperation => ({
   scope: operationScope(input),
   summary: {
      transferred: 0,
      skipped: 0,
      bytes: 0,
      failed: [],
      listingError: null,
      remaining: true,
   },
   page: null,
   nextToken: undefined,
   tokens: new Set(),
   exhausted: false,
   running: false,
});

const transferSummary = (operation: TransferOperation): TransferSummary => ({
   ...operation.summary,
   failed: [...operation.summary.failed],
});

const retryable = (error: unknown) =>
   error instanceof ApiError &&
   error.status === 429 &&
   error.code === ErrorCode.TRANSFER_NOT_STARTED;

const isRateLimited = (error: unknown) =>
   error instanceof ApiError && error.status === 429;

const readWhenAllowed = <T>(
   read: () => Promise<T>,
   signal: AbortSignal
): Promise<T> =>
   retryWithBackoff(read, {
      ...RATE_LIMIT_RETRY,
      shouldRetry: isRateLimited,
      signal,
   });

const refusalContext = (
   input: Pick<TransferInput, "bucketName" | "destination">,
   stage: "source" | "destination" | "copy"
): string => {
   const from = input.bucketName;
   const to = input.destination.bucketName;
   if (stage === "source") return `Couldn't read ${from}`;
   if (stage === "destination") return `Couldn't check ${to}`;
   return from === to
      ? `Copying within ${from} was refused`
      : `Copying from ${from} to ${to} was refused`;
};

const folderTransferOverlaps = (
   input: Pick<
      TransferInput,
      "serverId" | "bucketName" | "source" | "destination"
   >
): boolean => {
   const { source, destination } = input;
   if (!("folderKey" in source) || input.bucketName !== destination.bucketName)
      return false;
   return (
      prefixesOverlap(source.folderKey, destination.prefix) &&
      (source.folderKey !== destination.prefix ||
         input.serverId === destination.serverId)
   );
};

const transferObjects = async (
   input: TransferInput
): Promise<TransferSummary> => {
   const operation = input.operation ?? createTransferOperation(input);
   if (operation.scope !== operationScope(input))
      throw new Error("Start a new copy to change the source or destination.");
   if (operation.running) throw new Error("This copy is already running.");
   const { source, destination } = input;
   if (folderTransferOverlaps(input)) throw new Error(OVERLAP_ERROR);
   const signal = input.signal ?? NEVER_ABORTED;
   const summary = operation.summary;
   let failedThisPage = false;
   let stage: "source" | "destination" | "copy" = "source";
   let refusal: unknown = null;
   const progress = () =>
      input.onProgress?.({
         done: summary.transferred + summary.skipped,
         skipped: summary.skipped,
         bytes: summary.bytes,
      });
   const clearFailure = (key: string) => {
      summary.failed = summary.failed.filter((failure) => failure.key !== key);
   };
   const fail = (entry: TransferEntry, error: unknown) => {
      if (isFolderRefusal(error)) {
         refusal ??= error;
         return;
      }
      failedThisPage = true;
      const canRetry = retryable(error);
      entry.status = canRetry ? "pending" : "failed";
      clearFailure(entry.item.key);
      summary.failed.push({
         key: entry.item.key,
         message: canRetry
            ? errorMessage(error)
            : joinSentences(
                 errorMessage(error),
                 "Review this object at the destination before copying it again"
              ),
         retryable: canRetry,
      });
   };
   operation.running = true;
   summary.listingError = null;
   try {
      while (!operation.exhausted || operation.page) {
         failedThisPage = false;
         if (signal.aborted) throw cancelledError();
         if (!operation.page) {
            let keys: TransferItem[];
            stage = "source";
            if ("objects" in source) {
               keys = source.objects;
               operation.exhausted = true;
            } else {
               const page = await readWhenAllowed(
                  () =>
                     fetchKeysPage(
                        objectsPath(input.serverId, input.bucketName),
                        source.folderKey,
                        operation.nextToken,
                        signal
                     ),
                  signal
               );
               operation.nextToken = acceptKeysPage(
                  page,
                  source.folderKey,
                  operation.tokens
               );
               operation.exhausted = !operation.nextToken;
               keys = page.objects;
            }
            operation.page = [
               ...new Map(keys.map((item) => [item.key, item])).values(),
            ].map((item) => ({
               item: { ...item },
               objectKey: destinationKey(item.key, source, destination.prefix),
               status: "pending",
            }));
         }
         const pending = operation.page.filter(
            ({ status }) => status === "pending"
         );
         for (const entry of pending) {
            if (!objectKeySchema.safeParse(entry.objectKey).success)
               fail(
                  entry,
                  new ApiError(
                     400,
                     "The destination key must be valid and at most 1,024 UTF-8 bytes."
                  )
               );
         }
         let ready = pending.filter(({ status }) => status === "pending");
         if (!input.overwrite && ready.length) {
            stage = "destination";
            const objectKeys = ready.map(({ objectKey }) => objectKey);
            const { existing } = await readWhenAllowed(
               () =>
                  checkUploadConflicts({
                     serverId: destination.serverId,
                     bucketName: destination.bucketName,
                     keys: objectKeys,
                     signal,
                  }),
               signal
            );
            const present = new Set(existing);
            for (const entry of ready) {
               if (!present.has(entry.objectKey)) continue;
               entry.status = "done";
               clearFailure(entry.item.key);
               summary.skipped++;
            }
            ready = ready.filter(({ status }) => status === "pending");
            progress();
         }
         stage = "copy";
         await mapLimit(
            ready,
            TRANSFER_CONCURRENCY,
            async (entry) => {
               if (signal.aborted || refusal) return;
               clearFailure(entry.item.key);
               try {
                  const uploaded = await api.post<S3ObjectUploaded>(
                     `${serverPath(input.serverId)}${TRANSFERS_PATH}`,
                     {
                        expectedUserId: input.userId,
                        source: {
                           bucketName: input.bucketName,
                           objectKey: entry.item.key,
                           expectedETag: entry.item.expectedETag,
                        },
                        destination: {
                           serverId: destination.serverId,
                           bucketName: destination.bucketName,
                           objectKey: entry.objectKey,
                        },
                        overwrite: input.overwrite,
                     },
                     signal
                  );
                  entry.status = "done";
                  summary.transferred++;
                  summary.bytes += uploaded.size ?? entry.item.size ?? 0;
               } catch (error) {
                  fail(entry, error);
               }
               progress();
            },
            { signal, settle: true }
         );
         if (signal.aborted) throw cancelledError();
         if (refusal) throw refusal;
         if (operation.page.some(({ status }) => status === "pending")) break;
         operation.page = null;
         if (failedThisPage) break;
      }
   } catch (error) {
      if (isAborted(error)) throw error;
      summary.listingError = joinSentences(
         isFolderRefusal(error) ? refusalContext(input, stage) : null,
         errorMessage(error),
         "The copy is incomplete"
      );
   } finally {
      summary.remaining =
         !operation.exhausted ||
         Boolean(operation.page?.some(({ status }) => status === "pending"));
      operation.running = false;
   }
   return transferSummary(operation);
};

const reportTransferResult = (summary: TransferSummary) =>
   reportBatchResult(
      { ...summary, done: summary.transferred },
      {
         pastTenseVerb: "copied",
         incomplete: "The copy is incomplete",
         successNote:
            summary.skipped > 0
               ? `${summary.skipped} already existed and were left alone.`
               : undefined,
      }
   );

const useTransferObjects = () =>
   useObjectMutation({
      mutationFn: transferObjects,
      onSuccess: reportTransferResult,
      settle: ({ userId, destination }, queryClient) =>
         forgetObjects(
            queryClient,
            userId,
            destination.serverId,
            destination.bucketName,
            (key) => key.startsWith(destination.prefix)
         ),
   });

export default useTransferObjects;
export {
   createTransferOperation,
   folderTransferOverlaps,
   transferObjects,
   transferSummary,
};
export type {
   TransferOperation,
   TransferProgress,
   TransferSource,
   TransferSummary,
};
