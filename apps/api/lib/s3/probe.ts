import {
   HeadBucketCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import { listBuckets, probeBucketList } from "./bucket-listing";
import { getBucketClient } from "./bucket-client";
import { storageFailure } from "./classify";
import { StorageError } from "./errors";
import { isForbidden } from "./failure";
import { SECOND_MS } from "@s3-viewer/shared";

const CONNECT_TIMEOUT_MS = 15 * SECOND_MS;

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
   event: string,
   signal: AbortSignal
): Promise<number | null> => {
   try {
      return (await listBuckets(client, signal)).length;
   } catch (err) {
      if (isForbidden(err)) return null;
      throw storageFailure(err, "object", event);
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
         throw storageFailure(err, "bucket", "Validate buckets");
      }
      return false;
   }
};

const assertCredentialsWork = async (
   client: S3Client,
   allowedBuckets: readonly string[],
   event: string,
   signal: AbortSignal
): Promise<void> => {
   const bucketName = allowedBuckets[0];
   if (bucketName === undefined) {
      try {
         await probeBucketList(client, signal);
      } catch (err) {
         if (isForbidden(err))
            throw new StorageError(
               "forbidden",
               "These credentials can't list buckets"
            );
         throw storageFailure(err, "object", event);
      }
      return;
   }
   try {
      await headBucket(client, bucketName, signal);
   } catch (err) {
      const failure = storageFailure(err, "bucket", event);
      throw failure instanceof StorageError && failure.kind === "notFound"
         ? new StorageError("notFound", `Bucket ${bucketName} was not found`)
         : failure;
   }
};

export {
   assertCredentialsWork,
   canHeadBucket,
   CONNECT_TIMEOUT_MS,
   countBuckets,
};
