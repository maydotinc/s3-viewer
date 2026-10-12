import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { DEFAULT_CONTENT_TYPE, Provider } from "@s3-viewer/types";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { ApiHttpError } from "@/lib/http";
import { UPLOAD_CONFLICT } from "@/lib/constants";
import {
   assertDestinationAbsent,
   enforcesConditions,
   uploadConflict,
   uploadConflictError,
} from "./conditions";
import { sendHead } from "./head";
import type { S3Scope } from "./listing";
import { aclAttributes, readObjectAcl } from "./object-acl";
import { redirectAttributes } from "./object-metadata";
import { readObjectTagging, taggingOf } from "./object-tagging";

type ReplacementSettings = {
   versionId?: string;
   attributes: Partial<PutObjectCommandInput>;
};

const bestEffort = async <T>(
   read: () => Promise<T>
): Promise<undefined | T> => {
   try {
      return await read();
   } catch {
      return undefined;
   }
};

const readReplacementSettings = async (
   scope: S3Scope,
   key: string,
   expectedETag: string
): Promise<ReplacementSettings> => {
   const source = await sendHead(scope, key, expectedETag);
   if (source.ETag !== expectedETag)
      throw new ApiHttpError(
         409,
         "The file changed. Refresh and confirm the replacement again."
      );
   if (source.SSECustomerAlgorithm)
      throw new ApiHttpError(
         409,
         "This file's encryption key cannot be preserved. Upload this file under a new name instead."
      );
   return {
      versionId: source.VersionId,
      attributes: {
         ...redirectAttributes(source),
         Metadata: source.Metadata ?? {},
         ContentType: source.ContentType,
         CacheControl: source.CacheControl,
         ContentDisposition: source.ContentDisposition,
         ContentLanguage: source.ContentLanguage,
         Expires: source.Expires,
         StorageClass: source.StorageClass,
         ServerSideEncryption: source.ServerSideEncryption,
         SSEKMSKeyId: source.SSEKMSKeyId,
         BucketKeyEnabled: source.BucketKeyEnabled,
      },
   };
};

// exclude best-effort reads from the snapshot: a later read failure is not a change.
// R2 implements neither tags nor object ACLs.
const readReplacementExtras = async (
   scope: S3Scope,
   provider: Provider,
   key: string
): Promise<Partial<PutObjectCommandInput>> => {
   if (provider === Provider.R2) return {};
   const [tagging, grants] = await Promise.all([
      bestEffort(async () =>
         taggingOf((await readObjectTagging(scope, key)).TagSet)
      ),
      bestEffort(async () => aclAttributes(await readObjectAcl(scope, key))),
   ]);
   return { Tagging: tagging, ...grants };
};

const replacementContentType = (
   contentType: string,
   settings: ReplacementSettings | undefined
): string =>
   contentType === DEFAULT_CONTENT_TYPE
      ? (settings?.attributes.ContentType ?? contentType)
      : contentType;

const prepareUpload = async (
   scope: S3Scope,
   provider: Provider,
   {
      key,
      contentType,
      expectedETag,
   }: {
      key: string;
      contentType: string;
      expectedETag?: string;
   }
): Promise<{
   settings: ReplacementSettings | undefined;
   attributes: Partial<PutObjectCommandInput>;
}> => {
   if (expectedETag === undefined && !enforcesConditions(provider))
      await assertDestinationAbsent(scope, key, UPLOAD_CONFLICT);
   const settings =
      expectedETag === undefined
         ? undefined
         : await readReplacementSettings(scope, key, expectedETag).catch(
              (error: unknown) => {
                 if (uploadConflict(error)) throw uploadConflictError();
                 throw error;
              }
           );
   const extras = settings
      ? await readReplacementExtras(scope, provider, key)
      : undefined;
   return {
      settings,
      attributes: {
         ...settings?.attributes,
         ...extras,
         ContentType: replacementContentType(contentType, settings),
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

const canonicalSettings = (value: unknown): unknown => {
   if (value instanceof Date) return value.toISOString();
   if (value && typeof value === "object")
      return Object.fromEntries(
         Object.entries(value)
            .sort(([left], [right]) =>
               left < right ? -1 : left > right ? 1 : 0
            )
            .map(([key, entry]) => [key, canonicalSettings(entry)])
      );
   return value;
};

const replacementSettingsDigest = (settings: ReplacementSettings): string =>
   createHash("sha256")
      .update(JSON.stringify(canonicalSettings(settings)))
      .digest("base64url");

export {
   assertReplacementUnchanged,
   prepareUpload,
   readReplacementSettings,
   replacementSettingsDigest,
};
