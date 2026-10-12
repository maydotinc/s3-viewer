import { batchOutcome } from "@/components/Modals/batch-outcome";
import { errorMessage, isAborted } from "@/lib/api";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import { formatCount } from "@/lib/utils/format";
import { isBatchComplete, type BatchSummary } from "@/lib/utils/s3/batch";
import { useRef, useState } from "react";

type BulkOperationOptions = {
   folder: string | null;
   isPending: boolean;
   pastTenseVerb: string;
   progressNotice: (count: string) => string;
};

const useBulkOperation = <TFailure extends { retryable: boolean }>({
   folder,
   isPending,
   pastTenseVerb,
   progressNotice,
}: BulkOperationOptions) => {
   const [error, setError] = useState<string | null>(null);
   const [failed, setFailed] = useState<TFailure[]>([]);
   const [listingError, setListingError] = useState<string | null>(null);
   const [remaining, setRemaining] = useState(false);
   const [completed, setCompleted] = useState(0);
   const [progress, setProgress] = useState(0);
   const task = useAbortableTask();
   const completedBefore = useRef(0);

   useBeforeUnload(isPending);

   const outcome = batchOutcome({
      failed,
      listingError,
      completedCount: completed,
   });
   const stuck =
      outcome.stuck || Boolean(folder && outcome.needsReview.length > 0);

   const start = (): AbortSignal => {
      setError(null);
      completedBefore.current = completed;
      setProgress(0);
      return task.start();
   };

   const onProgress = (done: number) => task.ifMounted(() => setProgress(done));

   const onError = (failure: unknown) => {
      if (isAborted(failure)) return;
      task.ifMounted(() => setError(errorMessage(failure)));
   };

   const accept = (
      result: BatchSummary<TFailure>,
      settle: (complete: boolean) => void
   ) =>
      task.ifMounted(() => {
         const total = completedBefore.current + result.done;
         setCompleted(total);
         setProgress(0);
         setFailed([...result.failed, ...result.unsent]);
         setListingError(result.listingError);
         setRemaining(result.remaining);
         if (result.aborted)
            setError(
               `Cancelled, ${formatCount(total)} ${pastTenseVerb}. ${folder ? "Continue" : "Retry"} to finish the rest.`
            );
         settle(isBatchComplete(result));
      });

   return {
      ...outcome,
      stuck,
      error,
      setError,
      failed,
      listingError,
      remaining,
      completed,
      task,
      start,
      onProgress,
      onError,
      accept,
      progressNotice:
         folder && isPending && progress > 0
            ? progressNotice(formatCount(completed + progress))
            : undefined,
   };
};

export { useBulkOperation };
