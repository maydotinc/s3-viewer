import { walkPrefix } from "./walk-prefix";
import { cancelledError, errorMessage, isAborted } from "@/lib/api";
import { isFolderRefusal } from "@/lib/utils/folder-refusal";
import {
   formatCount,
   joinSentences,
   pluralize,
   visibleText,
} from "@/lib/utils/format";
import {
   NEVER_ABORTED,
   RATE_LIMIT_RETRY,
   backoffMs,
   sleep,
} from "@/lib/utils/retry";
import {
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   type S3KeysPage,
} from "@s3-viewer/shared";
import { toast } from "@s3-viewer/ui/components/toast";

const NAMED_FAILURES = 3;

type AnsweredFailure = {
   message: string;
   retryable?: boolean;
   refused?: boolean;
};

type BatchAnswer = {
   confirmed: ReadonlySet<string>;
   failed: ReadonlyMap<string, AnsweredFailure>;
};

const answerFrom = <TFailure extends AnsweredFailure>(
   confirmed: Iterable<string>,
   failed: readonly TFailure[],
   idOf: (failure: TFailure) => string
): BatchAnswer => ({
   confirmed: new Set(confirmed),
   failed: new Map(failed.map((failure) => [idOf(failure), failure])),
});

type BatchRun<TTarget, TResult> = {
   targets: readonly TTarget[];
   targetId: (target: TTarget) => string;
   responseTargetName?: (target: TTarget) => string;
   limit: number;
   send: (batch: TTarget[]) => Promise<TResult>;
   answer: (result: TResult) => BatchAnswer;
   unconfirmedMessage: string;
   transportFailureSuffix?: string;
   signal?: AbortSignal;
};

type BatchFailure<TTarget> = TTarget & {
   message: string;
   retryable: boolean;
   refused?: true;
};

type BatchSummary<TFailure> = {
   done: number;
   failed: TFailure[];
   unsent: TFailure[];
   listingError: string | null;
   remaining: boolean;
   aborted: boolean;
};

const NOT_SENT = "Cancelled before storage confirmed this object.";

const emptyBatchSummary = <TFailure>(): BatchSummary<TFailure> => ({
   done: 0,
   failed: [],
   unsent: [],
   listingError: null,
   remaining: false,
   aborted: false,
});

const runBatched = async <TTarget, TResult>({
   targets,
   targetId,
   responseTargetName = targetId,
   limit,
   send,
   answer,
   unconfirmedMessage,
   transportFailureSuffix,
   signal,
}: BatchRun<TTarget, TResult>): Promise<
   BatchSummary<BatchFailure<TTarget>>
> => {
   const outcome = emptyBatchSummary<BatchFailure<TTarget>>();
   const unique = new Map(targets.map((target) => [targetId(target), target]));
   const chunks = chunkKeys([...unique.keys()], limit, MAX_BATCH_KEY_CHARS);
   const cancelled = (from: number) => ({
      ...outcome,
      unsent: chunks.slice(from).flatMap((ids) =>
         ids.map((key) => ({
            ...unique.get(key)!,
            message: NOT_SENT,
            retryable: true,
         }))
      ),
      aborted: true,
      remaining: true,
   });
   for (const [index, ids] of chunks.entries()) {
      if (signal?.aborted) return cancelled(index);
      const batch = ids.map((key) => unique.get(key)!);
      try {
         const { confirmed, failed } = answer(await send(batch));
         for (const target of batch) {
            const key = responseTargetName(target);
            const failure = failed.get(key);
            if (!failure && confirmed.has(key)) outcome.done++;
            else
               outcome.failed.push({
                  ...target,
                  message: failure?.message ?? unconfirmedMessage,
                  retryable: !confirmed.has(key) && failure?.retryable === true,
                  ...(!confirmed.has(key) &&
                     failure?.refused === true && { refused: true }),
               });
         }
      } catch (error) {
         if (isAborted(error)) return cancelled(index);
         if (
            isFolderRefusal(error) &&
            outcome.done === 0 &&
            outcome.failed.length === 0
         )
            throw error;
         const message = transportFailureSuffix
            ? joinSentences(errorMessage(error), transportFailureSuffix)
            : errorMessage(error);
         for (const target of batch)
            outcome.failed.push({ ...target, message, retryable: false });
      }
   }
   return outcome;
};

const isBatchComplete = ({
   failed,
   listingError = null,
   remaining = false,
   aborted = false,
}: {
   failed: readonly unknown[];
   listingError?: string | null;
   remaining?: boolean;
   aborted?: boolean;
}): boolean => failed.length === 0 && !listingError && !remaining && !aborted;

const batchProgressSentence = (
   lead: string,
   failedCount: number,
   remaining: boolean,
   extra: string | null = null
): string =>
   [
      lead,
      extra,
      failedCount > 0 ? `${formatCount(failedCount)} failed` : null,
      remaining ? "more remain" : null,
   ]
      .filter(Boolean)
      .join("; ") + ".";

type BatchReport = {
   done: number;
   failed: readonly { key: string }[];
   listingError?: string | null;
   remaining?: boolean;
   aborted?: boolean;
};

type BatchWording = {
   pastTenseVerb: string;
   noun?: string;
   incomplete: string;
   successNote?: string;
};

const reportBatchResult = (
   {
      done,
      failed,
      listingError = null,
      remaining = false,
      aborted,
   }: BatchReport,
   { pastTenseVerb, noun = "object", incomplete, successNote }: BatchWording
) => {
   if (aborted) return;
   if (isBatchComplete({ failed, listingError, remaining })) {
      if (done === 0 && !successNote) return;
      const title = `${pluralize(done, noun)} ${pastTenseVerb}.`;
      if (successNote) toast.success(title, { description: successNote });
      else toast.success(title);
      return;
   }
   const names = failed
      .slice(0, NAMED_FAILURES)
      .map((failure) => visibleText(failure.key))
      .join(", ");
   const more =
      failed.length > NAMED_FAILURES
         ? ` and ${failed.length - NAMED_FAILURES} more`
         : "";
   const left = remaining ? " More objects remain." : "";
   toast.error(incomplete, {
      description:
         listingError ??
         `${done} ${pastTenseVerb}, ${failed.length} failed: ${names}${more}.${left}`,
   });
};

type RefusableFailure = { key: string; refused?: boolean };

const runPrefixBatches = async <TFailure extends RefusableFailure>({
   path,
   prefix,
   signal,
   incomplete,
   run,
   onProgress,
}: {
   path: string;
   prefix: string;
   signal?: AbortSignal;
   incomplete: string;
   run: (page: S3KeysPage) => Promise<BatchSummary<TFailure>>;
   onProgress?: (done: number) => void;
}): Promise<BatchSummary<TFailure>> => {
   const summary = emptyBatchSummary<TFailure>();
   const accept = (page: BatchSummary<TFailure>) => {
      summary.done += page.done;
      summary.failed.push(...page.failed);
      summary.listingError ??= page.listingError;
      summary.remaining ||= page.remaining;
      summary.aborted ||= page.aborted;
      onProgress?.(summary.done);
   };
   try {
      let waits = 0;
      for await (const page of walkPrefix(path, prefix, signal)) {
         let pending = page;
         let batch = await run(pending);
         for (;;) {
            if (
               batch.aborted ||
               waits >= RATE_LIMIT_RETRY.retries ||
               batch.failed.length === 0 ||
               batch.listingError ||
               !batch.failed.every(({ refused }) => refused)
            )
               break;
            const failedKeys = new Set(batch.failed.map(({ key }) => key));
            const objects = pending.objects.filter(({ key }) =>
               failedKeys.has(key)
            );
            if (objects.length === 0) break;
            accept({ ...batch, failed: [] });
            await sleep(
               backoffMs(waits++, RATE_LIMIT_RETRY),
               signal ?? NEVER_ABORTED
            );
            if (signal?.aborted) throw cancelledError();
            pending = { ...pending, objects };
            batch = await run(pending);
         }
         accept(batch);
         if (batch.failed.length > 0 || batch.aborted) {
            summary.remaining = true;
            break;
         }
         waits = 0;
      }
   } catch (error) {
      summary.remaining = true;
      if (isAborted(error)) summary.aborted = true;
      else
         summary.listingError = joinSentences(errorMessage(error), incomplete);
   }
   return summary;
};

export {
   answerFrom,
   batchProgressSentence,
   emptyBatchSummary,
   isBatchComplete,
   reportBatchResult,
   runBatched,
   runPrefixBatches,
};
export type { BatchFailure, BatchSummary };
