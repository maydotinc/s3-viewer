import { ApiHttpError } from "@/lib/http";
import {
   CopyObjectCommand,
   DeleteObjectCommand,
   HeadObjectCommand,
   type CopyObjectCommandInput,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { MAX_RENAME_BYTES, Provider } from "@s3-viewer/types";
import { isNotFound, throwHttpError } from "./errors";
import { encodeCopySource } from "./keys";
import type { S3Scope } from "./listing";

const copyAttributes = (
   head: HeadObjectCommandOutput
): Partial<CopyObjectCommandInput> => ({
   ...(head.StorageClass && { StorageClass: head.StorageClass }),
   ...(head.ServerSideEncryption && {
      ServerSideEncryption: head.ServerSideEncryption,
   }),
   ...(head.SSEKMSKeyId && { SSEKMSKeyId: head.SSEKMSKeyId }),
   ...(head.BucketKeyEnabled !== undefined && {
      BucketKeyEnabled: head.BucketKeyEnabled,
   }),
});

// An S3-compatible service may silently ignore conditional headers. Enable
// destructive rename only for a provider whose conditions are supported.
const renameObject = async (
   { client, bucket, signal }: S3Scope,
   provider: Provider,
   objectKey: string,
   newObjectKey: string
): Promise<void> => {
   if (provider !== Provider.S3) {
      throw new ApiHttpError(
         409,
         "Safe rename is only supported on AWS S3. Download the file and upload it under the new name instead."
      );
   }
   const options = { abortSignal: signal };
   const source = await client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }), options)
      .catch(throwHttpError);
   if ((source.ContentLength ?? 0) > MAX_RENAME_BYTES)
      throw new ApiHttpError(413, "Objects over 5 GB can't be renamed");
   if (!source.ETag)
      throw new ApiHttpError(
         409,
         "The object has no ETag, so it can't be safely renamed"
      );
   await client
      .send(
         new CopyObjectCommand({
            Bucket: bucket,
            Key: newObjectKey,
            CopySource: encodeCopySource(bucket, objectKey),
            CopySourceIfMatch: source.ETag,
            IfNoneMatch: "*",
            MetadataDirective: "COPY",
            ...copyAttributes(source),
         }),
         options
      )
      .catch((error: unknown) => {
         if (
            error instanceof Error &&
            ["PreconditionFailed", "ConditionalRequestConflict"].includes(
               error.name
            )
         ) {
            throw new ApiHttpError(
               409,
               "The original changed or the destination already exists. Refresh the folder and try again."
            );
         }
         throwHttpError(error);
      });

   try {
      await client.send(
         new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            IfMatch: source.ETag,
         }),
         options
      );
   } catch {
      // Never roll back the destination: somebody may already have updated
      // it. A timed-out delete may have succeeded; otherwise preserve both
      // names and explain the partial result instead of risking data loss.
      const remains = await client
         .send(
            new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
            options
         )
         .then(() => true)
         .catch((error: unknown) => (isNotFound(error) ? false : null));
      if (remains === false) return;
      throw new ApiHttpError(
         409,
         "The copy was created, but the original could not be safely removed. Refresh the folder and check both files before deleting either one."
      );
   }
};

export { renameObject };
