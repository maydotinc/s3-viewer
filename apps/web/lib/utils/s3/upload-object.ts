import { ApiError, ClientErrorCode } from "@/lib/api";
import useSessionStore from "@/lib/stores/session-store";
import { backoffMs, sleep } from "@/lib/utils/retry";
import {
   MULTIPART_THRESHOLD_BYTES,
   type S3ObjectUploaded,
} from "@s3-viewer/types";
import { nextUploadJob, uploadSlot } from "./slot-pool";
import { UploadCancelled } from "./upload-cancelled";
import {
   objectUploadUrl,
   putBytes,
   retryAfterMs,
   type TransportHandle,
   type UploadParams,
} from "./upload-transport";
import { uploadMultipart } from "./upload-multipart";

const NETWORK_RETRIES = 2;
const NETWORK_RETRY_BASE_MS = 500;
const BUSY_RETRIES = 8;
const BUSY_BASE_MS = 1_000;
const MAX_BUSY_BACKOFF_MS = 15_000;
const MAX_BUSY_WAIT_MS = 60_000;

const busyWaitMs = (attempt: number, error: unknown): number =>
   Math.min(
      MAX_BUSY_WAIT_MS,
      Math.max(
         retryAfterMs(error) ?? 0,
         backoffMs(attempt, {
            baseMs: BUSY_BASE_MS,
            maxMs: MAX_BUSY_BACKOFF_MS,
         })
      )
   );

const outcomeUnknown = () =>
   new ApiError(
      0,
      "Upload result unknown. Refresh the folder and review the file before uploading again.",
      ClientErrorCode.UPLOAD_OUTCOME_UNKNOWN
   );

type UploadHandle = TransportHandle<S3ObjectUploaded>;

const uploadSingle = ({
   userId,
   serverId,
   bucketName,
   objectKey,
   file,
   contentType,
   expectedETag,
   onProgress,
}: UploadParams): UploadHandle => {
   const url = objectUploadUrl({
      userId,
      serverId,
      bucketName,
      objectKey,
      contentType,
      expectedETag,
   });
   const job = nextUploadJob();
   const controller = new AbortController();
   let current: UploadHandle | null = null;

   const stopped = (): boolean =>
      controller.signal.aborted || useSessionStore.getState().userId !== userId;

   const run = async (): Promise<S3ObjectUploaded> => {
      let lost = 0;
      let busy = 0;
      for (;;) {
         if (stopped()) throw new UploadCancelled();
         try {
            return await uploadSlot(job, async () => {
               if (stopped()) throw new UploadCancelled();
               current = putBytes<S3ObjectUploaded>({
                  url,
                  body: file,
                  contentType,
                  userId,
                  onProgress,
               });
               return current.done;
            });
         } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            if (error.status === 429 && busy < BUSY_RETRIES) {
               onProgress(0);
               await sleep(busyWaitMs(busy++, error), controller.signal);
               continue;
            }
            if (
               error.status === 0 &&
               expectedETag === undefined &&
               lost < NETWORK_RETRIES
            ) {
               onProgress(0);
               await sleep(
                  backoffMs(lost++, { baseMs: NETWORK_RETRY_BASE_MS }),
                  controller.signal
               );
               continue;
            }
            if (error.status === 0 || (error.status === 409 && lost > 0))
               throw outcomeUnknown();
            throw error;
         }
      }
   };

   const cancelled = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
         "abort",
         () => reject(new UploadCancelled()),
         { once: true }
      );
   });

   const abort = () => {
      controller.abort();
      current?.abort();
   };

   return { done: Promise.race([run(), cancelled]), abort };
};

const uploadObject = (params: UploadParams): UploadHandle =>
   params.file.size > MULTIPART_THRESHOLD_BYTES
      ? uploadMultipart(params)
      : uploadSingle(params);

export { uploadObject, uploadSingle };
