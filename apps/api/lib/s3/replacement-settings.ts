import {
   GetBucketOwnershipControlsCommand,
   GetObjectAclCommand,
   GetObjectTaggingCommand,
   HeadObjectCommand,
   type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { isDeepStrictEqual } from "node:util";
import { ApiHttpError } from "../http";
import type { S3Scope } from "./listing";
import { aclAttributes } from "./object-acl";
import { readObjectLockSnapshot } from "./object-lock";

type ReplacementSettings = {
   versionId?: string;
   lock?: Awaited<ReturnType<typeof readObjectLockSnapshot>>;
   attributes: Partial<PutObjectCommandInput>;
};

const cannotPreserve = (reason: string): never => {
   throw new ApiHttpError(
      409,
      `${reason} Upload this file under a new name instead.`
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

   const identity = {
      Bucket: bucket,
      Key: key,
      ...(source.VersionId && { VersionId: source.VersionId }),
   };
   let permissions: Partial<PutObjectCommandInput> = {};
   let tagging: string | undefined;
   if (provider !== Provider.R2) {
      const ownership =
         provider === Provider.S3
            ? await client
                 .send(
                    new GetBucketOwnershipControlsCommand({ Bucket: bucket }),
                    options
                 )
                 .catch(() => null)
            : null;
      const enforced =
         ownership?.OwnershipControls?.Rules?.length === 1 &&
         ownership.OwnershipControls.Rules[0]?.ObjectOwnership ===
            "BucketOwnerEnforced";
      if (!enforced)
         permissions = aclAttributes(
            await client.send(new GetObjectAclCommand(identity), options)
         );
      const tags = await client.send(
         new GetObjectTaggingCommand(identity),
         options
      );
      if (!Array.isArray(tags.TagSet))
         cannotPreserve("The file's tags could not be read.");
      const encoded = new URLSearchParams();
      for (const tag of [...tags.TagSet!].sort((a, b) =>
         (a.Key ?? "").localeCompare(b.Key ?? "")
      )) {
         if (tag.Key === undefined || tag.Value === undefined)
            cannotPreserve("The file's tags could not be read.");
         encoded.append(tag.Key!, tag.Value!);
      }
      tagging = encoded.toString();
   }
   const lock =
      provider === Provider.R2
         ? undefined
         : await readObjectLockSnapshot({ client, bucket, signal }, identity);
   return {
      versionId: source.VersionId,
      lock,
      attributes: {
         ...permissions,
         Metadata: source.Metadata ?? {},
         ContentType: source.ContentType,
         CacheControl: source.CacheControl,
         ContentDisposition: source.ContentDisposition,
         ContentLanguage: source.ContentLanguage,
         Expires: source.Expires,
         StorageClass: source.StorageClass,
         ...(provider !== Provider.R2 && {
            Tagging: tagging,
            WebsiteRedirectLocation: source.WebsiteRedirectLocation,
            ServerSideEncryption: source.ServerSideEncryption,
            ...lock?.attributes,
         }),
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

export { assertReplacementUnchanged, readReplacementSettings };
