import { api, multipartUploadsPath } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { BucketTarget } from "@/lib/types";
import {
   answerFrom,
   reportBatchResult,
   runBatched,
} from "@/lib/utils/s3/batch";
import {
   type S3AbortUploadsResult,
   type S3MultipartUpload,
   type S3UploadFailure,
   type S3UploadRef,
} from "@s3-viewer/types";
import useObjectMutation from "./object-mutation";

const ABORT_BATCH_UPLOADS = 100;

type AbortSummary = {
   aborted: number;
   failed: S3UploadFailure[];
   cancelled: boolean;
};

const UNCONFIRMED =
   "Storage did not confirm the abort. Refresh and check this upload.";

const pairId = (target: S3UploadRef) => `${target.key}\u0000${target.uploadId}`;

const abortUploads = async (
   path: string,
   uploads: readonly S3UploadRef[],
   userId: string,
   signal?: AbortSignal
): Promise<AbortSummary> => {
   const outcome = await runBatched<S3UploadRef, S3AbortUploadsResult>({
      targets: uploads,
      targetId: pairId,
      limit: ABORT_BATCH_UPLOADS,
      send: (batch) =>
         api.delete<S3AbortUploadsResult>(
            path,
            {
               expectedUserId: userId,
               uploads: batch.map(({ key, uploadId }) => ({ key, uploadId })),
            },
            signal
         ),
      answer: (result) =>
         answerFrom(result.aborted.map(pairId), result.failed, pairId),
      unconfirmedMessage: UNCONFIRMED,
      signal,
   });
   return {
      aborted: outcome.done,
      failed: outcome.failed.map(({ key, uploadId, message }) => ({
         key,
         uploadId,
         message,
      })),
      cancelled: outcome.aborted,
   };
};

const reportAbortResult = ({ aborted, failed, cancelled }: AbortSummary) =>
   reportBatchResult(
      { done: aborted, failed, aborted: cancelled },
      {
         pastTenseVerb: "aborted",
         noun: "incomplete upload",
         incomplete: "Some uploads could not be aborted",
      }
   );

const useAbortMultipartUploads = () =>
   useObjectMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         uploads,
         signal,
      }: BucketTarget & {
         uploads: S3MultipartUpload[] | S3UploadRef[];
         signal?: AbortSignal;
      }) =>
         abortUploads(
            multipartUploadsPath(serverId, bucketName),
            uploads,
            userId,
            signal
         ),
      onSuccess: reportAbortResult,
      settle: ({ userId, serverId, bucketName }, queryClient) =>
         void queryClient.invalidateQueries({
            queryKey: queryKeys.multipartUploads(userId, serverId, bucketName),
         }),
   });

export default useAbortMultipartUploads;
export { abortUploads, pairId };
