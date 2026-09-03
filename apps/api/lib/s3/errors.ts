import { ErrorCode } from "@s3-viewer/types";
import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { classifyListBucketsError, classifyS3Error } from "./classify";

const CREDENTIALS_UNREADABLE_MESSAGE =
   "Server credentials can't be read. Update them to continue.";

const credentialsUnreadableError = (): ApiHttpError =>
   new ApiHttpError(
      409,
      CREDENTIALS_UNREADABLE_MESSAGE,
      ErrorCode.CREDENTIALS_UNREADABLE
   );

const mapError = (
   err: unknown,
   classify: typeof classifyS3Error
): ApiHttpError => {
   if (err instanceof ApiHttpError) return err;
   const { status, message, code, name } = classify(err);
   logger.warn("S3 request failed", { s3Error: name, status });
   return new ApiHttpError(status, message, code);
};

const toHttpError = (err: unknown): ApiHttpError =>
   mapError(err, classifyS3Error);

const throwHttpError = (err: unknown): never => {
   throw toHttpError(err);
};

const throwListBucketsError = (err: unknown): never => {
   throw mapError(err, classifyListBucketsError);
};

const isNotFound = (err: unknown): boolean =>
   classifyS3Error(err).status === 404;

export {
   credentialsUnreadableError,
   isNotFound,
   throwHttpError,
   throwListBucketsError,
   toHttpError,
};
