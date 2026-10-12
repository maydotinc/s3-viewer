import {
   HeadBucketCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import { ApiHttpError } from "@/lib/http";
import { listBuckets, probeBucketList } from "./bucket-listing";
import { getBucketClient } from "./bucket-client";
import { toBucketHttpError, toHttpError } from "./errors";
import { isForbidden } from "./failure";

const CONNECT_TIMEOUT_MS = 15_000;

const headBucket = async (
   client: S3Client,
   bucketName: string,
   abortSignal: AbortSignal
): Promise<void> => {
   const regional = await getBucketClient(client, bucketName, abortSignal);
   await regional.send(new HeadBucketCommand({ Bucket: bucketName }), {
      abortSignal,
   });
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
      if (isForbidden(err)) return null;
      throw toHttpError(err, event);
   }
};

const canHeadBucket = async (
   client: S3Client,
   bucketName: string,
   abortSignal: AbortSignal
): Promise<boolean> => {
   try {
      await headBucket(client, bucketName, abortSignal);
      return true;
   } catch (err) {
      if (!(err instanceof S3ServiceException)) {
         throw toBucketHttpError(err, "Validate buckets");
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
      try {
         await probeBucketList(client, AbortSignal.timeout(CONNECT_TIMEOUT_MS));
      } catch (err) {
         if (isForbidden(err))
            throw new ApiHttpError(403, "These credentials can't list buckets");
         throw toHttpError(err, event);
      }
      return;
   }
   try {
      await headBucket(
         client,
         bucketName,
         AbortSignal.timeout(CONNECT_TIMEOUT_MS)
      );
   } catch (err) {
      const failure = toBucketHttpError(err, event);
      throw failure.status === 404
         ? new ApiHttpError(404, `Bucket ${bucketName} was not found`)
         : failure;
   }
};

export { assertCredentialsWork, canHeadBucket, countBuckets };
