import {
   HeadBucketCommand,
   ListBucketsCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { classifyS3Error } from "./classify";

const CONNECT_TIMEOUT_MS = 15_000;

const isAccessDenied = (err: unknown): boolean =>
   err instanceof S3ServiceException && err.name === "AccessDenied";

/** Classifies a probe failure and logs it under the flow that ran it ("Establish", "Credential update"). */
const probeFailure = (err: unknown, event: string): ApiHttpError => {
   const { status, message, code, name } = classifyS3Error(err);
   logger.warn(`${event} failed`, { s3Error: name, status });
   return new ApiHttpError(status, message, code);
};

/** Bucket count for credentials that may list, `null` when they may not. */
const countBuckets = async (
   client: S3Client,
   event: string
): Promise<number | null> => {
   try {
      const out = await client.send(new ListBucketsCommand({}), {
         abortSignal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
      return out.Buckets?.length ?? 0;
   } catch (err) {
      if (isAccessDenied(err)) return null;
      throw probeFailure(err, event);
   }
};

const canHeadBucket = async (
   client: S3Client,
   bucketName: string,
   abortSignal: AbortSignal
): Promise<boolean> => {
   try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal,
      });
      return true;
   } catch {
      return false;
   }
};

/**
 * Proves a credential set can do what the server needs: reach the first
 * bucket the server is limited to, or list buckets when it has no such list.
 */
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
      await client.send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
   } catch (err) {
      const failure = probeFailure(err, event);
      throw failure.status === 404
         ? new ApiHttpError(404, `Bucket ${bucketName} was not found`)
         : failure;
   }
};

export { assertCredentialsWork, canHeadBucket, countBuckets };
