import { S3_ROUTE_TIMEOUT_MS, copyDeadlineMs } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { withDeadline } from "@/lib/utils/abort";
import {
   DeleteObjectCommand,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import {
   Provider,
   mapLimit,
   type MoveObjectsInput,
   type S3KeyFailure,
   type S3MoveResult,
} from "@s3-viewer/types";
import { objectPresent } from "./conditions";
import { copyObject } from "./copy";
import { refusedFailure, toHttpError } from "./errors";
import type { S3Scope } from "./listing";
import { withoutBudget } from "./no-retry";
import { headReviewed } from "./object-metadata";

const PARTIAL_RENAME =
   "The copy was created, but the original could not be removed. Refresh and check both files.";

class PartialRenameError extends ApiHttpError {
   constructor() {
      super(409, PARTIAL_RENAME);
   }
}

const stillPresent = (scope: S3Scope, key: string): Promise<boolean | null> =>
   objectPresent(scope, key).catch(() => null);

// only AWS documents conditional DeleteObject; other providers need a final HEAD before deletion.
const deleteSource = async (
   scope: S3Scope,
   provider: Provider,
   objectKey: string,
   expectedETag: string
): Promise<void> => {
   const { client, bucket, signal } = scope;
   if (provider !== Provider.S3)
      await headReviewed(scope, objectKey, expectedETag);
   signal?.throwIfAborted();
   await client.send(
      new DeleteObjectCommand({
         Bucket: bucket,
         Key: objectKey,
         ...(provider === Provider.S3 ? { IfMatch: expectedETag } : {}),
      }),
      { abortSignal: signal }
   );
};

type RenameRequest = {
   objectKey: string;
   newObjectKey: string;
   source: HeadObjectCommandOutput;
   sourceETag: string;
};

const renameObject = async (
   scope: S3Scope,
   provider: Provider,
   { objectKey, newObjectKey, source, sourceETag }: RenameRequest
): Promise<void> => {
   await copyObject(scope, provider, {
      sourceKey: objectKey,
      destinationKey: newObjectKey,
      source,
      sourceETag,
   });
   const committed = { ...scope, client: withoutBudget(scope.client) };
   try {
      await deleteSource(committed, provider, objectKey, sourceETag);
   } catch {
      // never roll back the destination: another writer may own it, and a timed-out delete may have landed.
      const remains = await stillPresent(committed, objectKey);
      if (remains === false) return;
      throw new PartialRenameError();
   }
};

const MOVE_CONCURRENCY = 8;

type MoveTarget = MoveObjectsInput["objects"][number];

const partialFailures = new WeakSet<S3KeyFailure>();

const partialCopies = (result: S3MoveResult): string[] =>
   result.failed.flatMap((failure) =>
      partialFailures.has(failure) ? [failure.key] : []
   );

const moveOne = async (
   scope: S3Scope,
   provider: Provider,
   { key, newKey, expectedETag }: MoveTarget
): Promise<S3KeyFailure | null> => {
   try {
      // the batch signal only tracks the caller, so a stalled HEAD needs its own deadline.
      const source = await withDeadline(
         scope.signal,
         S3_ROUTE_TIMEOUT_MS,
         (signal) => headReviewed({ ...scope, signal }, key, expectedETag)
      );
      const sourceETag = source.ETag;
      if (!sourceETag)
         throw new ApiHttpError(
            409,
            "The file has no ETag, so it can't be moved."
         );
      await withDeadline(
         scope.signal,
         copyDeadlineMs(source.ContentLength ?? 0),
         (signal) =>
            renameObject({ ...scope, signal }, provider, {
               objectKey: key,
               newObjectKey: newKey,
               source,
               sourceETag,
            })
      );
      return null;
   } catch (error) {
      const { status, message } = toHttpError(error);
      const failure = refusedFailure(error, key) ?? {
         key,
         message,
         retryable: status >= 500,
      };
      if (error instanceof PartialRenameError) partialFailures.add(failure);
      return failure;
   }
};

const moveObjects = async (
   scope: S3Scope,
   provider: Provider,
   targets: readonly MoveTarget[]
): Promise<S3MoveResult> => {
   const failures = await mapLimit(
      targets,
      MOVE_CONCURRENCY,
      (target) => moveOne(scope, provider, target),
      { signal: scope.signal }
   );
   const result: S3MoveResult = { moved: [], failed: [] };
   targets.forEach(({ key }, index) => {
      const failure = failures[index];
      if (failure === null) result.moved.push(key);
      else if (failure) result.failed.push(failure);
      else
         result.failed.push({
            key,
            message: "The move was cancelled before this file was reached.",
            retryable: true,
         });
   });
   return result;
};

export { PartialRenameError, moveObjects, partialCopies, renameObject };
