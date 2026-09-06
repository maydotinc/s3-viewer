import { ApiHttpError } from "@/lib/http";
import {
   AbortMultipartUploadCommand,
   CompleteMultipartUploadCommand,
   CopyObjectCommand,
   CreateMultipartUploadCommand,
   PutObjectCommand,
   S3ServiceException,
   UploadPartCopyCommand,
   type CopyObjectCommandInput,
   type HeadObjectCommandOutput,
   type Tag,
} from "@aws-sdk/client-s3";
import { Provider, observedETagSchema } from "@s3-viewer/types";
import { encodeCopySource } from "./keys";
import type { S3Scope } from "./listing";
import { withoutRetries } from "./no-retry";

const copiedMetadata = (head: HeadObjectCommandOutput) => ({
   Metadata: head.Metadata ?? {},
   ContentType: head.ContentType,
   CacheControl: head.CacheControl,
   ContentDisposition: head.ContentDisposition,
   ContentEncoding: head.ContentEncoding,
   ContentLanguage: head.ContentLanguage,
   Expires: head.Expires,
   WebsiteRedirectLocation: head.WebsiteRedirectLocation,
});

const copyAttributes = (head: HeadObjectCommandOutput, provider: Provider) => ({
   ...(head.StorageClass && { StorageClass: head.StorageClass }),
   ...(provider !== Provider.R2 && {
      WebsiteRedirectLocation: head.WebsiteRedirectLocation,
      ServerSideEncryption: head.ServerSideEncryption,
      SSEKMSKeyId: head.SSEKMSKeyId,
      BucketKeyEnabled: head.BucketKeyEnabled,
      ObjectLockMode: head.ObjectLockMode,
      ObjectLockRetainUntilDate: head.ObjectLockRetainUntilDate,
      ObjectLockLegalHoldStatus: head.ObjectLockLegalHoldStatus,
   }),
});

const copyForRename = async (
   { client, bucket, signal }: S3Scope,
   provider: Provider,
   source: HeadObjectCommandOutput,
   objectKey: string,
   newObjectKey: string,
   acl?: Partial<CopyObjectCommandInput>,
   tags?: Tag[]
): Promise<{ ETag?: string; VersionId?: string }> => {
   const writer = withoutRetries(client);
   const options = { abortSignal: signal };
   const sourceCopy = {
      CopySource: `${encodeCopySource(bucket, objectKey)}${source.VersionId ? `?versionId=${encodeURIComponent(source.VersionId)}` : ""}`,
      CopySourceIfMatch: source.ETag,
   };
   const target = { Bucket: bucket, Key: newObjectKey };
   const attributes = copyAttributes(source, provider);
   if (provider !== Provider.Other) {
      const input: CopyObjectCommandInput = {
         ...target,
         ...sourceCopy,
         ...attributes,
         MetadataDirective: "COPY",
         ...(provider === Provider.S3 && { IfNoneMatch: "*" }),
      };
      const command = new CopyObjectCommand({ ...input, ...acl });
      if (provider === Provider.R2) {
         command.middlewareStack.add(
            (next) => async (args) => {
               const request = args.request as {
                  headers: Record<string, string>;
               };
               request.headers["cf-copy-destination-if-none-match"] = "*";
               return next(args);
            },
            { step: "build", name: "r2CopyDestinationCondition" }
         );
      }
      const result = await writer
         .send(command, options)
         .catch((error: unknown) => {
            if (
               provider === Provider.S3 &&
               acl &&
               error instanceof S3ServiceException &&
               error.name === "AccessControlListNotSupported" &&
               error.$metadata.httpStatusCode === 400
            )
               return writer.send(new CopyObjectCommand(input), options);
            throw error;
         });
      return {
         ETag: result.CopyObjectResult?.ETag,
         VersionId: result.VersionId,
      };
   }
   if (source.MissingMeta)
      throw new ApiHttpError(
         409,
         "Some object metadata could not be read and preserved."
      );
   const tagging = new URLSearchParams();
   for (const tag of tags ?? []) {
      if (tag.Key === undefined || tag.Value === undefined)
         throw new ApiHttpError(
            409,
            "The object's tags could not be preserved."
         );
      tagging.append(tag.Key, tag.Value);
   }
   const metadata = {
      ...copiedMetadata(source),
      ...attributes,
      ...(tagging.size && { Tagging: tagging.toString() }),
   };
   if (source.ContentLength === 0) {
      return writer.send(
         new PutObjectCommand({
            ...target,
            ...metadata,
            Body: new Uint8Array(),
            ContentLength: 0,
            IfNoneMatch: "*",
         }),
         options
      );
   }
   const created = await writer.send(
      new CreateMultipartUploadCommand({ ...target, ...metadata }),
      options
   );
   if (!created.UploadId)
      throw new ApiHttpError(
         502,
         "The storage server did not return an upload identifier."
      );
   const upload = { ...target, UploadId: created.UploadId };
   try {
      const part = await writer.send(
         new UploadPartCopyCommand({ ...upload, ...sourceCopy, PartNumber: 1 }),
         options
      );
      if (!observedETagSchema.safeParse(part.CopyPartResult?.ETag).success)
         throw new ApiHttpError(
            502,
            "The storage server did not confirm the copied part."
         );
      return await writer.send(
         new CompleteMultipartUploadCommand({
            ...upload,
            IfNoneMatch: "*",
            MultipartUpload: {
               Parts: [{ PartNumber: 1, ETag: part.CopyPartResult?.ETag }],
            },
         }),
         options
      );
   } catch (error) {
      await client
         .send(new AbortMultipartUploadCommand(upload), {
            abortSignal: AbortSignal.timeout(10_000),
         })
         .catch(() => undefined);
      throw error;
   }
};

export { copiedMetadata, copyForRename };
