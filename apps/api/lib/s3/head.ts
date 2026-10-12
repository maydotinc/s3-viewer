import {
   HeadObjectCommand,
   type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   DEFAULT_CONTENT_TYPE,
   type Role,
   type S3ObjectMetadata,
   type S3ObjectSettings,
} from "@s3-viewer/types";
import { isNotFound, throwHttpError } from "./errors";
import type { S3Scope } from "./listing";

const sendHead = (
   { client, bucket, signal }: S3Scope,
   key: string,
   ifMatch?: string
): Promise<HeadObjectCommandOutput> =>
   client.send(
      new HeadObjectCommand({
         Bucket: bucket,
         Key: key,
         ...(ifMatch === undefined ? {} : { IfMatch: ifMatch }),
      }),
      { abortSignal: signal }
   );

const headObject = (
   scope: S3Scope,
   key: string
): Promise<HeadObjectCommandOutput> =>
   sendHead(scope, key).catch(throwHttpError);

const headIfExists = (
   scope: S3Scope,
   key: string
): Promise<HeadObjectCommandOutput | null> =>
   sendHead(scope, key).catch((error: unknown) =>
      isNotFound(error) ? null : throwHttpError(error)
   );

const toMetadata = (head: HeadObjectCommandOutput): S3ObjectMetadata => ({
   contentType: head.ContentType ?? DEFAULT_CONTENT_TYPE,
   contentLength: head.ContentLength ?? 0,
   lastModified: head.LastModified?.toISOString() ?? null,
   storageClass: head.StorageClass ?? null,
   eTag: head.ETag ?? null,
});

// contentEncoding stays visible because the preview must know whether the body is compressed.
const VIEWER_REDACTIONS = {
   cacheControl: null,
   contentDisposition: null,
   contentLanguage: null,
   expires: null,
   metadata: {},
   serverSideEncryption: null,
   sseKmsKeyId: null,
   versionId: null,
} satisfies Partial<S3ObjectSettings>;

// user metadata, the KMS key ARN and the version id are for those who can change the object.
const toSettings = (
   head: HeadObjectCommandOutput,
   bucketRole: Role | null
): S3ObjectSettings => {
   const settings: S3ObjectSettings = {
      ...toMetadata(head),
      cacheControl: head.CacheControl ?? null,
      contentDisposition: head.ContentDisposition ?? null,
      contentEncoding: head.ContentEncoding ?? null,
      contentLanguage: head.ContentLanguage ?? null,
      expires: head.Expires?.toISOString() ?? null,
      metadata: head.Metadata ?? {},
      serverSideEncryption: head.ServerSideEncryption ?? null,
      sseKmsKeyId: head.SSEKMSKeyId ?? null,
      versionId: head.VersionId ?? null,
   };
   return hasPermission(bucketRole, Permission.UPLOAD_OBJECT)
      ? settings
      : { ...settings, ...VIEWER_REDACTIONS };
};

export { headIfExists, headObject, sendHead, toSettings };
