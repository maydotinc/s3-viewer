import { batchOutcome } from "@/components/Modals/batch-outcome";
import { errorMessage, isAborted, objectsPath } from "@/lib/api";
import type { BulkRenameSource } from "@/lib/contexts/modal-sources";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import type { BucketTarget } from "@/lib/types";
import useMoveObjects, {
   type MoveSummary,
   type MoveTarget,
} from "@/lib/hooks/mutations/object/useMoveObjects";
import { formatCount } from "@/lib/utils/format";
import {
   isBlocked,
   planBulkRename,
   type BulkRenameOperation,
   type BulkRenamePlan,
   type BulkRenameRow,
} from "@/lib/utils/s3/bulk-rename";
import type { S3DeleteTarget } from "@s3-viewer/types";
import { useEffect, useMemo, useState } from "react";
import type { BulkRenameStep } from "./notices";
import { collectSources, findExisting } from "./plan";

type BulkRenameInput = BucketTarget & {
   source: BulkRenameSource;
   operation: BulkRenameOperation;
   previewMatchesInput: boolean;
   onRenamed?: () => void;
   onClose: () => void;
};

type BulkRenameRun = {
   sources: S3DeleteTarget[] | null;
   listed: number;
   truncated: boolean;
   plan: BulkRenamePlan;
   pending: BulkRenameRow[];
   existing: string[];
   failed: MoveSummary["failed"];
   needsReview: MoveSummary["failed"];
   renamed: number;
   attempted: boolean;
   error: string | null;
   step: BulkRenameStep | null;
   blocked: boolean;
   submit: () => void;
   forget: () => void;
   cancel: () => void;
};

const sourceTargets = (source: BulkRenameSource): S3DeleteTarget[] =>
   "folderKey" in source
      ? [{ key: source.folderKey, expectedETag: null }]
      : source.objects;

const useBulkRename = ({
   userId,
   serverId,
   bucketName,
   source,
   operation,
   previewMatchesInput,
   onRenamed,
   onClose,
}: BulkRenameInput): BulkRenameRun => {
   const moveObjects = useMoveObjects();
   const [sources, setSources] = useState<S3DeleteTarget[] | null>(null);
   const [listed, setListed] = useState(0);
   const [truncated, setTruncated] = useState(false);
   const [existing, setExisting] = useState<string[]>([]);
   const [failed, setFailed] = useState<MoveSummary["failed"]>([]);
   const [renamed, setRenamed] = useState(0);
   const [attempted, setAttempted] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [step, setStep] = useState<BulkRenameStep | null>(null);
   const task = useAbortableTask();
   const path = objectsPath(serverId, bucketName);

   useEffect(() => {
      const signal = task.start();
      setStep("listing");
      void collectSources({
         path,
         targets: sourceTargets(source),
         signal,
         onProgress: (total) =>
            task.ifMounted(() => {
               if (!signal.aborted) setListed(total);
            }),
      })
         .then((snapshot) =>
            task.ifMounted(() => {
               if (signal.aborted) return;
               setSources(snapshot.objects);
               setTruncated(snapshot.truncated);
               setStep(null);
            })
         )
         .catch((failure: unknown) => {
            if (signal.aborted || isAborted(failure)) return;
            task.ifMounted(() => {
               setSources([]);
               setError(errorMessage(failure));
               setStep(null);
            });
         });
      return () => task.cancel();
   }, [path, source, task]);

   useBeforeUnload(step === "renaming");

   const keys = useMemo(() => (sources ?? []).map(({ key }) => key), [sources]);
   const plan = useMemo(
      () => planBulkRename(keys, operation),
      [keys, operation]
   );
   const eTags = useMemo(
      () =>
         new Map(
            (sources ?? []).map(({ key, expectedETag }) => [key, expectedETag])
         ),
      [sources]
   );
   const { retryable, needsReview, stuck } = batchOutcome({ failed });
   const pending: BulkRenameRow[] =
      failed.length > 0
         ? retryable.map(({ key, newKey }) => ({ key, newKey }))
         : plan.rows;
   const blocked =
      truncated ||
      stuck ||
      !previewMatchesInput ||
      (failed.length === 0 && isBlocked(plan));

   const forget = () => {
      setError(null);
      setExisting((previous) => (previous.length === 0 ? previous : []));
   };

   const accept = (summary: MoveSummary) =>
      task.ifMounted(() => {
         setStep(null);
         setAttempted(true);
         setRenamed((count) => count + summary.done);
         setFailed([...needsReview, ...summary.failed, ...summary.unsent]);
         if (summary.done > 0) onRenamed?.();
         if (summary.aborted)
            setError(
               `Cancelled, ${formatCount(renamed + summary.done)} renamed. Objects already renamed keep their new names — continue to finish the rest.`
            );
         else if (summary.failed.length === 0 && needsReview.length === 0)
            onClose();
      });

   const submit = () => {
      if (step || blocked || pending.length === 0) return;
      forget();
      const signal = task.start();
      setStep("checking");
      void (async () => {
         try {
            const rows = attempted
               ? await findExisting(
                    path,
                    pending.map((row) => row.key),
                    signal
                 ).then((alive) => {
                    const left = new Set(alive);
                    return pending.filter((row) => left.has(row.key));
                 })
               : pending;
            const taken = await findExisting(
               path,
               rows.map((row) => row.newKey),
               signal
            );
            task.ifMounted(() => {
               if (signal.aborted) return;
               if (taken.length > 0) {
                  setExisting(taken);
                  setStep(null);
                  return;
               }
               if (rows.length === 0) {
                  setStep(null);
                  onClose();
                  return;
               }
               setStep("renaming");
               const objects: MoveTarget[] = rows.map(({ key, newKey }) => ({
                  key,
                  newKey,
                  expectedETag: eTags.get(key) ?? null,
               }));
               moveObjects.mutate(
                  { userId, serverId, bucketName, objects, signal },
                  {
                     onSuccess: accept,
                     onError: (failure: unknown) =>
                        task.ifMounted(() => {
                           setStep(null);
                           setAttempted(true);
                           setError(errorMessage(failure));
                        }),
                  }
               );
            });
         } catch (failure: unknown) {
            if (signal.aborted || isAborted(failure)) return;
            task.ifMounted(() => {
               setStep(null);
               setError(errorMessage(failure));
            });
         }
      })();
   };

   return {
      sources,
      listed,
      truncated,
      plan,
      pending,
      existing,
      failed,
      needsReview,
      renamed,
      attempted,
      error,
      step,
      blocked,
      submit,
      forget,
      cancel: () => {
         task.cancel();
         if (step === "listing") onClose();
         if (step === "checking") {
            setStep(null);
            setError("Cancelled. Review the preview and try again.");
         }
      },
   };
};

export default useBulkRename;
