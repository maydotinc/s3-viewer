import { ErrorCode, type S3KeyFailure } from "@s3-viewer/types";
import type { Readable } from "node:stream";
import { ApiHttpError, isRateLimited, rateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { classifyS3Error, type FailureScope } from "./classify";
import { StorageStalledError, UploadIdleError } from "./progress-floor";

const CREDENTIALS_UNREADABLE_MESSAGE =
   "Server credentials can't be read. Update them to continue.";
const CREDENTIALS_CHANGED_MESSAGE =
   "Server credentials changed while connecting. Try again.";

const credentialsUnreadableError = (): ApiHttpError =>
   new ApiHttpError(
      409,
      CREDENTIALS_UNREADABLE_MESSAGE,
      ErrorCode.CREDENTIALS_UNREADABLE
   );

const refusedFailure = (err: unknown, key: string): S3KeyFailure | undefined =>
   isRateLimited(err)
      ? { key, message: err.message, retryable: true, refused: true }
      : undefined;

const uploadLimitMessage = (limit: number): string =>
   `Uploads are limited to ${limit} bytes`;

const uploadTooLarge = (limit: number): ApiHttpError =>
   new ApiHttpError(413, uploadLimitMessage(limit));

const mapError = (
   err: unknown,
   scope: FailureScope,
   event = "S3 request"
): ApiHttpError => {
   if (err instanceof ApiHttpError) return err;
   const { status, message, code, name } = classifyS3Error(err, scope);
   logger.warn(`${event} failed`, { s3Error: name, status });
   return new ApiHttpError(status, message, code);
};

const toHttpError = (err: unknown, event?: string): ApiHttpError =>
   mapError(err, "object", event);

const toBucketHttpError = (err: unknown, event?: string): ApiHttpError =>
   mapError(err, "bucket", event);

const throwHttpError = (err: unknown): never => {
   throw toHttpError(err);
};

const throwListBucketsError = (err: unknown): never => {
   throw mapError(err, "bucketList");
};

const throwBucketError = (err: unknown): never => {
   throw toBucketHttpError(err);
};

const isNotFound = (err: unknown): boolean =>
   classifyS3Error(err).status === 404;

const requireBody = (body: unknown): Readable => {
   if (!body) throw new ApiHttpError(502, "Storage returned no body.");
   return body as Readable;
};

const requirePartETag = (eTag: string | undefined): string => {
   if (!eTag) throw new ApiHttpError(502, "Storage returned no part ETag.");
   return eTag;
};

// a slot expiry is an idle error too, so this covers every progress-floor abort.
const isStalled = (
   reason: unknown
): reason is UploadIdleError | StorageStalledError =>
   reason instanceof UploadIdleError || reason instanceof StorageStalledError;

export {
   CREDENTIALS_CHANGED_MESSAGE,
   credentialsUnreadableError,
   isNotFound,
   isStalled,
   rateLimited,
   refusedFailure,
   requireBody,
   requirePartETag,
   throwBucketError,
   throwHttpError,
   throwListBucketsError,
   toBucketHttpError,
   toHttpError,
   uploadLimitMessage,
   uploadTooLarge,
};
