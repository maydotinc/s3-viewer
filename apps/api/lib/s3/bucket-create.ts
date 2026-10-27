import {
   CreateBucketCommand,
   HeadBucketCommand,
   type S3Client,
   S3ServiceException,
   type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/shared";
import { isNotFound, storageFailure } from "./classify";
import { StorageError } from "./errors";
import type { BucketCreationLifecycle } from "./bucket-creation-coordination";
import { sentMarker } from "./conditions";
import { bucketRegionHeader } from "./failure";
import { withoutRetries } from "./no-retry";

class BucketExistsError extends StorageError {
   constructor(bucketName: string) {
      super("conflict", `${bucketName} already exists`);
   }
}

const createNewBucket = async (
   client: S3Client,
   provider: Provider,
   bucketName: string,
   signal: AbortSignal,
   lifecycle: BucketCreationLifecycle
): Promise<void> => {
   const once = withoutRetries(client);
   const exists = await once
      .send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal: signal,
      })
      .then(() => true)
      .catch((err: unknown) => {
         if (isNotFound(err)) return false;
         if (provider === Provider.S3 && bucketRegionHeader(err)) return true;
         throw storageFailure(err, "bucket");
      });
   if (exists) throw new BucketExistsError(bucketName);

   const region = await once.config.region();
   signal.throwIfAborted();
   await lifecycle.submitted();
   const create = new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration:
         provider === Provider.S3 && region !== "us-east-1"
            ? { LocationConstraint: region as BucketLocationConstraint }
            : undefined,
   });
   const sent = sentMarker(create);
   await once.send(create, { abortSignal: signal }).catch((err: unknown) => {
      if (
         !sent() ||
         (err instanceof S3ServiceException &&
            (err.$metadata.httpStatusCode ?? 0) >= 400 &&
            (err.$metadata.httpStatusCode ?? 0) < 500 &&
            err.$metadata.httpStatusCode !== 408 &&
            err.name !== "RequestTimeout")
      ) {
         lifecycle.settled();
      }
      if (
         err instanceof S3ServiceException &&
         (err.name === "BucketAlreadyOwnedByYou" ||
            err.name === "BucketAlreadyExists")
      ) {
         throw new BucketExistsError(bucketName);
      }
      throw storageFailure(err, "bucket");
   });
   lifecycle.settled();
};

export { BucketExistsError, createNewBucket };
