import { ErrorCode, type S3KeyFailure } from "@s3-viewer/shared";
import type { Readable } from "node:stream";

// the storage layer says what went wrong; toHttpFailure is the one place a kind becomes a status.
const STATUS_BY_KIND = {
   invalid: 400,
   forbidden: 403,
   notFound: 404,
   conflict: 409,
   tooLarge: 413,
   rateLimited: 429,
   upstream: 502,
   unavailable: 503,
   busy: 503,
} as const;

type StorageErrorKind = keyof typeof STATUS_BY_KIND;

class StorageError extends Error {
   constructor(
      readonly kind: StorageErrorKind,
      message: string,
      readonly code?: ErrorCode
   ) {
      super(message);
      this.name = "StorageError";
   }
}

type HttpFailure = { status: number; message: string; code?: ErrorCode };

const toHttpFailure = (err: unknown): HttpFailure | undefined =>
   err instanceof StorageError
      ? {
           status: STATUS_BY_KIND[err.kind],
           message: err.message,
           ...(err.code && { code: err.code }),
        }
      : undefined;

// storage-side failures may clear on their own; the rest answer what the caller asked for.
const isStorageSide = (kind: StorageErrorKind): boolean =>
   STATUS_BY_KIND[kind] >= 500;

const CREDENTIALS_UNREADABLE_MESSAGE =
   "Server credentials can't be read. Update them to continue.";
const CREDENTIALS_CHANGED_MESSAGE =
   "Server credentials changed while connecting. Try again.";

const credentialsUnreadable = (): StorageError =>
   new StorageError(
      "conflict",
      CREDENTIALS_UNREADABLE_MESSAGE,
      ErrorCode.CREDENTIALS_UNREADABLE
   );

const credentialsChanged = (): StorageError =>
   new StorageError("conflict", CREDENTIALS_CHANGED_MESSAGE);

// an admission limit of this instance turned the request away before storage saw it.
const refusal = (message: string): StorageError =>
   new StorageError("rateLimited", message, ErrorCode.RATE_LIMITED);

const isRefusal = (err: unknown): err is StorageError =>
   err instanceof StorageError && err.kind === "rateLimited";

const refusedFailure = (err: unknown, key: string): S3KeyFailure | undefined =>
   isRefusal(err)
      ? { key, message: err.message, retryable: true, refused: true }
      : undefined;

const uploadLimitMessage = (limit: number): string =>
   `Uploads are limited to ${limit} bytes`;

const uploadTooLarge = (limit: number): StorageError =>
   new StorageError("tooLarge", uploadLimitMessage(limit));

const requireBody = (body: unknown): Readable => {
   if (!body) throw new StorageError("upstream", "Storage returned no body.");
   return body as Readable;
};

const requirePartETag = (eTag: string | undefined): string => {
   if (!eTag)
      throw new StorageError("upstream", "Storage returned no part ETag.");
   return eTag;
};

export {
   CREDENTIALS_CHANGED_MESSAGE,
   StorageError,
   credentialsChanged,
   credentialsUnreadable,
   isStorageSide,
   refusal,
   refusedFailure,
   requireBody,
   requirePartETag,
   toHttpFailure,
   uploadLimitMessage,
   uploadTooLarge,
};
export type { HttpFailure, StorageErrorKind };
