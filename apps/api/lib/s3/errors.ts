import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { classifyS3Error } from "./classify";

const toHttpError = (err: unknown): ApiHttpError => {
   if (err instanceof ApiHttpError) return err;
   const { status, message, name } = classifyS3Error(err);
   logger.warn("S3 request failed", { s3Error: name, status });
   return new ApiHttpError(status, message);
};

const throwHttpError = (err: unknown): never => {
   throw toHttpError(err);
};

const isNotFound = (err: unknown): boolean =>
   classifyS3Error(err).status === 404;

export { isNotFound, throwHttpError, toHttpError };
