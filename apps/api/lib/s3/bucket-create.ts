import { ApiHttpError } from "@/lib/http";
import {
   CreateBucketCommand,
   HeadBucketCommand,
   type S3Client,
   S3ServiceException,
   type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { isNotFound, throwBucketError } from "./errors";
import { withoutRetries } from "./no-retry";

const createNewBucket = async (
   client: S3Client,
   provider: Provider,
   bucketName: string,
   signal: AbortSignal
): Promise<void> => {
   const once = withoutRetries(client);
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
