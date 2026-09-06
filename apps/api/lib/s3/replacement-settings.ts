import {
   HeadObjectCommand,
   type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { isDeepStrictEqual } from "node:util";
import { ApiHttpError } from "../http";
import type { S3Scope } from "./listing";

type ReplacementSettings = {
   versionId?: string;
   attributes: Partial<PutObjectCommandInput>;
};

const cannotPreserve = (reason: string): never => {
   throw new ApiHttpError(
      409,
      `${reason} Upload this file under a new name instead.`
   );
};

const assertReplacementSupported = (provider: Provider): void => {
   if (provider !== Provider.R2)
      cannotPreserve(
         "Replacement is unavailable because concurrent permission changes cannot be safely preserved."
      );
};

// A replacement is a new object in S3: omitted settings revert to defaults.
// Never infer missing permissions, metadata, or encryption from a failed read.
const readReplacementSettings = async (
   { client, bucket, signal }: S3Scope,
   provider: Provider,
   key: string,
   expectedETag: string
): Promise<ReplacementSettings> => {
   assertReplacementSupported(provider);
   const options = { abortSignal: signal };
   const source = await client.send(
      new HeadObjectCommand({
         Bucket: bucket,
         Key: key,
         IfMatch: expectedETag,
      }),
      options
   );
   if (source.ETag !== expectedETag)
      throw new ApiHttpError(
         409,
         "The file changed. Refresh and confirm the replacement again."
      );
   if (source.MissingMeta)
      cannotPreserve("The file's complete metadata could not be read.");
   // HEAD does not expose a KMS object's additional encryption context or
   // customer encryption key. Reusing only its algorithm/key ID is insufficient.
   if (
      source.SSECustomerAlgorithm ||
      (source.ServerSideEncryption &&
         source.ServerSideEncryption !== "AES256") ||
      source.SSEKMSKeyId
   )
      cannotPreserve(
         "This file's encryption settings cannot be fully preserved."
      );
   // The browser supplies decoded/local bytes, not the original wire encoding.
   if (source.ContentEncoding)
      cannotPreserve(
         "This file has a content encoding that cannot be preserved for a replacement."
      );

   return {
      versionId: source.VersionId,
      attributes: {
         Metadata: source.Metadata ?? {},
         ContentType: source.ContentType,
         CacheControl: source.CacheControl,
         ContentDisposition: source.ContentDisposition,
         ContentLanguage: source.ContentLanguage,
         Expires: source.Expires,
         StorageClass: source.StorageClass,
      },
   };
};

const assertReplacementUnchanged = (
   original: ReplacementSettings,
   current: ReplacementSettings
): void => {
   if (!isDeepStrictEqual(original, current))
      throw new ApiHttpError(
         409,
         "The file's settings changed. Refresh and confirm the replacement again."
      );
};

export {
   assertReplacementSupported,
   assertReplacementUnchanged,
   readReplacementSettings,
};
