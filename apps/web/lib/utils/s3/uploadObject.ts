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

const sleep = (ms: number) =>
   new Promise<void>((resolve) => setTimeout(resolve, ms));

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

const parseBody = (xhr: XMLHttpRequest): ApiErrorBody | null => {
   try {
      return JSON.parse(xhr.responseText) as ApiErrorBody;
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
         if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(file.size);
            resolve(JSON.parse(xhr.responseText) as S3ObjectUploaded);
         } else {
            reject(responseError(xhr.status, parseBody(xhr)));
         }
      };
      xhr.onerror = () => reject(networkError());
      xhr.onabort = () =>
         reject(cancelled ? new UploadCancelled() : networkError());
      xhr.open("PUT", url);
      xhr.withCredentials = true;
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
   let cancelled = false;
   let current: UploadHandle | null = null;

   const run = async (): Promise<S3ObjectUploaded> => {
      for (let attempt = 0; ; attempt++) {
         if (cancelled) throw new UploadCancelled();
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
            await sleep(500 * 2 ** attempt);
         }
      }
   };

   const abort = () => {
      cancelled = true;
      current?.abort();
   };

   return { done: run(), abort };
};

export { uploadObject };
