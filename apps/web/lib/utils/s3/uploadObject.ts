import {
   ApiError,
   apiUrl,
   networkError,
   objectsPath,
   qs,
   responseError,
} from "@/lib/api";
import type {
   ApiError as ApiErrorBody,
   S3ObjectUploaded,
} from "@s3-viewer/types";
import { UploadCancelled } from "./upload-cancelled";

const NETWORK_RETRIES = 2;
const MIN_UPLOAD_TIMEOUT_MS = 30_000;
const MIN_UPLOAD_THROUGHPUT_BYTES_PER_SEC = 50 * 1024;

const uploadTimeoutMs = (size: number) =>
   Math.max(
      MIN_UPLOAD_TIMEOUT_MS,
      Math.ceil((size / MIN_UPLOAD_THROUGHPUT_BYTES_PER_SEC) * 1000)
   );

const sleep = (ms: number, signal: AbortSignal) =>
   new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const onAbort = () => {
         clearTimeout(timer);
         resolve();
      };
      const timer = setTimeout(() => {
         signal.removeEventListener("abort", onAbort);
         resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
   });

type UploadParams = {
   serverId: string;
   bucketName: string;
   objectKey: string;
   file: File;
   contentType: string;
   onProgress: (loadedBytes: number) => void;
};

type UploadHandle = {
   done: Promise<S3ObjectUploaded>;
   abort: () => void;
};

const parseJson = <T>(xhr: XMLHttpRequest): T | null => {
   try {
      return JSON.parse(xhr.responseText) as T;
   } catch {
      return null;
   }
};

const putOnce = (
   url: string,
   file: File,
   contentType: string,
   onProgress: (loadedBytes: number) => void
): UploadHandle => {
   const xhr = new XMLHttpRequest();
   let cancelled = false;

   const done = new Promise<S3ObjectUploaded>((resolve, reject) => {
      xhr.upload.onprogress = (event) => {
         if (event.lengthComputable)
            onProgress(Math.min(event.loaded, file.size));
      };
      xhr.onload = () => {
         if (xhr.status < 200 || xhr.status >= 300) {
            reject(responseError(xhr.status, parseJson<ApiErrorBody>(xhr)));
            return;
         }
         const uploaded = parseJson<S3ObjectUploaded>(xhr);
         if (!uploaded) {
            reject(responseError(xhr.status, null));
            return;
         }
         onProgress(file.size);
         resolve(uploaded);
      };
      xhr.onerror = () => reject(networkError());
      xhr.ontimeout = () => reject(networkError());
      xhr.onabort = () =>
         reject(cancelled ? new UploadCancelled() : networkError());
      xhr.open("PUT", url);
      xhr.withCredentials = true;
      xhr.timeout = uploadTimeoutMs(file.size);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.send(file);
   });

   const abort = () => {
      cancelled = true;
      if (xhr.readyState !== XMLHttpRequest.DONE) xhr.abort();
   };

   return { done, abort };
};

const uploadObject = ({
   serverId,
   bucketName,
   objectKey,
   file,
   contentType,
   onProgress,
}: UploadParams): UploadHandle => {
   const url = apiUrl(
      `${objectsPath(serverId, bucketName)}${qs({ objectKey, contentType })}`
   );
   const controller = new AbortController();
   let current: UploadHandle | null = null;

   const run = async (): Promise<S3ObjectUploaded> => {
      for (let attempt = 0; ; attempt++) {
         if (controller.signal.aborted) throw new UploadCancelled();
         current = putOnce(url, file, contentType, onProgress);
         try {
            return await current.done;
         } catch (error) {
            const retry =
               error instanceof ApiError &&
               error.status === 0 &&
               attempt < NETWORK_RETRIES;
            if (!retry) throw error;
            onProgress(0);
            await sleep(500 * 2 ** attempt, controller.signal);
         }
      }
   };

   const abort = () => {
      controller.abort();
      current?.abort();
   };

   return { done: run(), abort };
};

export { uploadObject };
