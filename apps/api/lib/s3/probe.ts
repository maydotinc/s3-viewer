import {
   HeadBucketCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { classifyBucketError, classifyS3Error } from "./classify";
import { listBuckets } from "./bucket-listing";
import { getBucketClient } from "./bucket-client";

const CONNECT_TIMEOUT_MS = 15_000;

const isAccessDenied = (err: unknown): boolean =>
   err instanceof S3ServiceException && err.name === "AccessDenied";

const probeFailure = (
   err: unknown,
   event: string,
   classify: typeof classifyS3Error = classifyS3Error
): ApiHttpError => {
   const { status, message, code, name } = classify(err);
   logger.warn(`${event} failed`, { s3Error: name, status });
   return new ApiHttpError(status, message, code);
};

const countBuckets = async (
   client: S3Client,
   event: string
): Promise<number | null> => {
   try {
      return (
         await listBuckets(client, AbortSignal.timeout(CONNECT_TIMEOUT_MS))
      ).length;
   } catch (err) {
      if (isAccessDenied(err)) return null;
      if (err instanceof ApiHttpError) throw err;
      throw probeFailure(err, event);
   }
};

const canHeadBucket = async (
   client: S3Client,
   bucketName: string,
   abortSignal: AbortSignal
): Promise<boolean> => {
   try {
      const regional = await getBucketClient(client, bucketName, abortSignal);
      await regional.send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal,
      });
      return true;
   } catch (err) {
      // only an answer from the storage service means "no access"; a dead host
      // must fail the whole call instead of reporting every bucket unreachable
      if (!(err instanceof S3ServiceException)) {
         throw probeFailure(err, "Validate buckets", classifyBucketError);
      }
      return false;
   }
};

const assertCredentialsWork = async (
   client: S3Client,
   allowedBuckets: readonly string[],
   event: string
): Promise<void> => {
   const bucketName = allowedBuckets[0];
   if (bucketName === undefined) {
      if ((await countBuckets(client, event)) === null) {
         throw new ApiHttpError(403, "These credentials can't list buckets");
      }
      return;
   }
   try {
      const abortSignal = AbortSignal.timeout(CONNECT_TIMEOUT_MS);
      const regional = await getBucketClient(client, bucketName, abortSignal);
      await regional.send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal,
      });
   } catch (err) {
      const failure = probeFailure(err, event, classifyBucketError);
      throw failure.status === 404
         ? new ApiHttpError(404, `Bucket ${bucketName} was not found`)
         : failure;
   }
};

export { assertCredentialsWork, canHeadBucket, countBuckets };
