import { ApiHttpError } from "@/lib/http";
import {
   CreateBucketCommand,
   HeadBucketCommand,
   S3Client,
   S3ServiceException,
   type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { isNotFound, throwBucketError } from "./errors";

const createNewBucket = async (
   client: S3Client,
   provider: Provider,
   bucketName: string,
   signal: AbortSignal
): Promise<void> => {
   // In us-east-1, repeating a successful CreateBucket resets the existing
   // bucket's ACL. A lost response must never cause an SDK retry. This client
   // shares the supplied client's transport, so it must not destroy that handler.
   const once = new S3Client({
      ...client.config,
      maxAttempts: 1,
      retryStrategy: undefined,
      serviceConfiguredEndpoint: undefined,
   });
   const exists = await once
      .send(new HeadBucketCommand({ Bucket: bucketName }), {
         abortSignal: signal,
      })
      .then(() => true)
      .catch((err: unknown) => {
         if (isNotFound(err)) return false;
         return throwBucketError(err);
      });
   if (exists) throw new ApiHttpError(409, `${bucketName} already exists`);

   const region = await once.config.region();
   await once
      .send(
         new CreateBucketCommand({
            Bucket: bucketName,
            CreateBucketConfiguration:
               provider === Provider.S3 && region !== "us-east-1"
                  ? { LocationConstraint: region as BucketLocationConstraint }
                  : undefined,
         }),
         { abortSignal: signal }
      )
      .catch((err: unknown) => {
         if (
            err instanceof S3ServiceException &&
            (err.name === "BucketAlreadyOwnedByYou" ||
               err.name === "BucketAlreadyExists")
         ) {
            throw new ApiHttpError(409, `${bucketName} already exists`);
         }
         throwBucketError(err);
      });
};

export { createNewBucket };
