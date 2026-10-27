import {
   ApiError,
   ClientErrorCode,
   apiUrl,
   handleUnauthorized,
   networkError,
   objectMutationPath,
   qs,
   responseError,
} from "@/lib/api";
import type { BucketTarget } from "@/lib/types";
import type { ApiError as ApiErrorBody } from "@s3-viewer/shared";
import { UploadCancelledError } from "./upload-cancelled";

const MIN_UPLOAD_TIMEOUT_MS = 30_000;
const MIN_UPLOAD_THROUGHPUT_BYTES_PER_SEC = 50 * 1024;

const uploadTimeoutMs = (size: number) =>
   Math.max(
      MIN_UPLOAD_TIMEOUT_MS,
      Math.ceil((size / MIN_UPLOAD_THROUGHPUT_BYTES_PER_SEC) * 1000)
   );

const outcomeUnknown = () =>
   new ApiError(
      0,
      "Upload result unknown. Refresh the folder and review the file before uploading again.",
      ClientErrorCode.UPLOAD_OUTCOME_UNKNOWN
   );

// status 0 keeps a part retryable; a single PUT or a complete with this answer did write, so callers map it
const unreadableAnswer = () =>
   new ApiError(
      0,
      "The server sent an unexpected response. Try again.",
      ClientErrorCode.BAD_RESPONSE
   );

// a 2xx whose body can't be read: storage acted, the answer was lost on the way back
const isUnreadableAnswer = (error: unknown): boolean =>
   error instanceof ApiError &&
   error.code === ClientErrorCode.BAD_RESPONSE &&
   (error.status === 0 || (error.status >= 200 && error.status < 300));

const retryAfter = new WeakMap<object, number>();

const retryAfterMs = (error: unknown): number | undefined =>
   typeof error === "object" && error !== null
      ? retryAfter.get(error)
      : undefined;

const objectUploadUrl = ({
   userId,
   serverId,
   bucketName,
   objectKey,
   contentType,
   expectedETag,
}: BucketTarget & {
   objectKey: string;
   contentType: string;
   expectedETag?: string;
}): string =>
   apiUrl(
      `${objectMutationPath(serverId, bucketName, "/upload")}${qs({ objectKey, contentType, expectedETag, expectedUserId: userId })}`
   );

type UploadParams = BucketTarget & {
   objectKey: string;
   file: File;
   contentType: string;
   expectedETag?: string;
   onProgress: (loadedBytes: number) => void;
};

type TransportHandle<T> = {
   done: Promise<T>;
   abort: () => void;
};

type PutParams = {
   url: string;
   body: Blob;
   contentType: string;
   userId: string;
   onProgress?: (loadedBytes: number) => void;
};

const parseJson = <T>(xhr: XMLHttpRequest): T | null => {
   try {
      return JSON.parse(xhr.responseText) as T;
   } catch {
      return null;
   }
};

const putBytes = <T>({
   url,
   body,
   contentType,
   userId,
   onProgress,
}: PutParams): TransportHandle<T> => {
   const xhr = new XMLHttpRequest();
   let cancelled = false;

   const done = new Promise<T>((resolve, reject) => {
      xhr.upload.onprogress = (event) => {
         if (event.lengthComputable)
            onProgress?.(Math.min(event.loaded, body.size));
      };
      xhr.onload = () => {
         if (xhr.status < 200 || xhr.status >= 300) {
            if (xhr.status === 401) handleUnauthorized(userId);
            const error = responseError(
               xhr.status,
               parseJson<ApiErrorBody>(xhr)
            );
            if (xhr.status === 429) {
               const seconds = Number(xhr.getResponseHeader("Retry-After"));
               if (Number.isFinite(seconds) && seconds > 0)
                  retryAfter.set(error, seconds * 1000);
            }
            reject(error);
            return;
         }
         const result = parseJson<T>(xhr);
         if (!result) {
            reject(unreadableAnswer());
            return;
         }
         onProgress?.(body.size);
         resolve(result);
      };
      xhr.onerror = () => reject(networkError());
      xhr.ontimeout = () => reject(networkError());
      xhr.onabort = () =>
         reject(cancelled ? new UploadCancelledError() : networkError());
      xhr.open("PUT", url);
      xhr.withCredentials = true;
      xhr.timeout = uploadTimeoutMs(body.size);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(body);
   });

   const abort = () => {
      cancelled = true;
      if (xhr.readyState !== XMLHttpRequest.DONE) xhr.abort();
   };

   return { done, abort };
};

export {
   isUnreadableAnswer,
   objectUploadUrl,
   outcomeUnknown,
   putBytes,
   retryAfterMs,
};
export type { TransportHandle, UploadParams };
