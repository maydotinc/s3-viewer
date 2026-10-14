import {
   AbortMultipartUploadCommand,
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   ListMultipartUploadsCommand,
   ListPartsCommand,
   UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
   MAX_MULTIPART_PARTS,
   MAX_UPLOAD_ID_CHARS,
   Provider,
   S3_MAX_KEYS_PER_REQUEST,
   isPrefixInFolderScope,
   mapLimit,
   type MultipartUploadsQuery,
   type S3AbortUploadsResult,
   type S3MultipartCreated,
   type S3MultipartUploadPage,
   type S3ObjectUploaded,
   type S3UploadedPart,
   type S3UploadFailure,
   type S3UploadRef,
} from "@s3-viewer/types";
import { createHash } from "node:crypto";
import { type Readable } from "node:stream";
import { CLEANUP_TIMEOUT_MS, UPLOAD_CONFLICT } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { noop, withDeadline } from "@/lib/utils/abort";
import {
   assertDestinationAbsent,
   conditionalInitiation,
   conflictAs,
   enforcesConditions,
   uploadConflict,
   uploadConflictError,
   writeCondition,
} from "./conditions";
import {
   isNotFound,
   throwBucketError,
   throwHttpError,
   toHttpError,
   uploadTooLarge,
} from "./errors";
import {
   compareUtf8,
   decodeOptionalKey,
   justBefore,
   keyHash,
   utf8Before,
} from "./keys";
import type { S3Scope } from "./listing";
import { forCancel, forCleanup, withoutRetries } from "./no-retry";
import { clientProvider, clientSupportsMultipartPrefix } from "./provider";
import {
   floorGuard,
   StorageStalledError,
   UploadIdleError,
} from "./progress-floor";
import {
   BUFFER_MEMORY_FACTOR,
   copyRetainedString,
   retainedRead,
} from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { releaseBufferedResponse } from "./response-collector";
import { signer } from "./signed-token";
import {
   prepareUpload,
   readReplacementSettings,
   replacementSettingsDigest,
} from "./replacement-settings";

const ABORT_CONCURRENCY = 4;
const MAX_PART_PAGES = Math.ceil(MAX_MULTIPART_PARTS / S3_MAX_KEYS_PER_REQUEST);
const PART_MEMORY_OVERHEAD_BYTES = 128;

type UploadsQuery = Pick<
   MultipartUploadsQuery,
   "prefix" | "keyMarker" | "uploadIdMarker"
>;

const listStoredUploads = async (
   { client, bucket, signal }: S3Scope,
   { prefix, keyMarker, uploadIdMarker }: UploadsQuery
): Promise<S3MultipartUploadPage> => {
   const serverPrefix =
      prefix && (await clientSupportsMultipartPrefix(client))
         ? prefix
         : undefined;
   const localPrefix = prefix && !serverPrefix ? prefix : undefined;
   const page = await client
      .send(
         new ListMultipartUploadsCommand({
            Bucket: bucket,
            Prefix: serverPrefix,
            EncodingType: "url",
            MaxUploads: S3_MAX_KEYS_PER_REQUEST,
            KeyMarker: keyMarker ?? (localPrefix && justBefore(localPrefix)),
            UploadIdMarker: uploadIdMarker,
         }),
         { abortSignal: signal }
      )
      .catch(throwBucketError);

   const uploads =
      page.EncodingType === "url"
         ? page.Uploads?.map((upload) => ({
              ...upload,
              Key: decodeOptionalKey(upload.Key),
           }))
         : page.Uploads;
   const nextKeyMarker =
      page.EncodingType === "url"
         ? decodeOptionalKey(page.NextKeyMarker)
         : page.NextKeyMarker;

   // some gateways omit next-page markers; the last returned row supplies the cursor.
   const fallback = nextKeyMarker ? undefined : uploads?.at(-1);
   const nextKey =
      page.IsTruncated === true
         ? (nextKeyMarker ?? fallback?.Key ?? null)
         : null;
   const truncated =
      page.IsTruncated === true &&
      !(
         localPrefix !== undefined &&
         nextKey !== null &&
         !nextKey.startsWith(localPrefix) &&
         utf8Before(localPrefix, nextKey)
      );

   return {
      uploads: (uploads ?? []).flatMap((upload) =>
         upload.Key && upload.UploadId && upload.Key.startsWith(prefix ?? "")
            ? [
                 {
                    key: upload.Key,
                    uploadId: upload.UploadId,
                    initiated: upload.Initiated?.toISOString() ?? null,
                    storageClass: upload.StorageClass ?? null,
                 },
              ]
            : []
      ),
      nextKeyMarker: truncated ? nextKey : null,
      nextUploadIdMarker: truncated
         ? (page.NextUploadIdMarker ?? fallback?.UploadId ?? null)
         : null,
   };
};

const MAX_FOLDER_UPLOAD_PAGES = 20;

const NO_MORE_UPLOADS: S3MultipartUploadPage = {
   uploads: [],
   nextKeyMarker: null,
   nextUploadIdMarker: null,
};

// markers are only in-folder keys or the next folder's name, so bucket-wide listings reveal nothing else.
const walkUploadsInFolders = async (
   scope: S3Scope,
   folders: readonly string[],
   { prefix = "", keyMarker, uploadIdMarker }: UploadsQuery
): Promise<S3MultipartUploadPage> => {
   const ranges = (
      isPrefixInFolderScope(folders, prefix)
         ? [prefix]
         : folders.filter((folder) => folder.startsWith(prefix))
   ).sort(compareUtf8);
   let index = keyMarker
      ? ranges.findIndex((range) => keyMarker.startsWith(range))
      : 0;
   if (index < 0 || ranges.length === 0) return NO_MORE_UPLOADS;

   const startOf = (range: string) => ({
      key: justBefore(range),
      uploadId: undefined as string | undefined,
   });
   let marker =
      !keyMarker || (keyMarker === ranges[index] && !uploadIdMarker)
         ? startOf(ranges[index]!)
         : { key: keyMarker, uploadId: uploadIdMarker };
   const uploads: S3MultipartUploadPage["uploads"] = [];
   let atRangeStart = true;

   for (let calls = 0; calls < MAX_FOLDER_UPLOAD_PAGES; calls++) {
      const range = ranges[index]!;
      const page = await listStoredUploads(scope, {
         prefix: range,
         keyMarker: marker.key,
         uploadIdMarker: marker.uploadId,
      });
      const next = page.nextKeyMarker;
      if (next !== null && next.startsWith(range)) {
         // a bare folder name means "start of folder", so a page ending on it needs an upload id.
         const last = page.uploads.at(-1);
         return {
            uploads: [...uploads, ...page.uploads],
            nextKeyMarker: next,
            nextUploadIdMarker:
               page.nextUploadIdMarker ??
               (last?.key === next ? last.uploadId : null),
         };
      }
      if (next !== null && utf8Before(next, range)) {
         marker = { key: next, uploadId: page.nextUploadIdMarker ?? undefined };
         atRangeStart = false;
         continue;
      }
      uploads.push(...page.uploads);
      index++;
      const following = ranges[index];
      if (following === undefined) return { ...NO_MORE_UPLOADS, uploads };
      if (uploads.length > 0) {
         return { uploads, nextKeyMarker: following, nextUploadIdMarker: null };
      }
      marker = startOf(following);
      atRangeStart = true;
   }
   if (atRangeStart) {
      return {
         uploads,
         nextKeyMarker: ranges[index]!,
         nextUploadIdMarker: null,
      };
   }
   throw new ApiHttpError(
      503,
      "This bucket has too many incomplete uploads outside your folders to list yours. Ask the bucket owner to clear them."
   );
};

// bare storage ids are refused: a backend that finds uploads by id alone would cancel another key's.
const sealListedUploads = (
   serverId: string,
   bucket: string,
   page: S3MultipartUploadPage
): S3MultipartUploadPage => ({
   ...page,
   uploads: page.uploads.map((upload) => {
      const uploadId = sealListedUpload(upload.uploadId, {
         serverId,
         bucket,
         key: upload.key,
      });
      if (uploadId) return { ...upload, uploadId };
      logger.warn("Multipart upload id is too long to list", {
         bucket,
         keyHash: keyHash(upload.key),
      });
      return {
         ...upload,
         uploadId: unusableUploadId(upload.key, upload.uploadId),
      };
   }),
});

const listMultipartUploads = async (
   scope: S3Scope,
   serverId: string,
   query: UploadsQuery
): Promise<S3MultipartUploadPage> =>
   sealListedUploads(
      serverId,
      scope.bucket,
      await listStoredUploads(scope, query)
   );

const listUploadsInFolders = async (
   scope: S3Scope,
   serverId: string,
   folders: readonly string[],
   query: UploadsQuery
): Promise<S3MultipartUploadPage> =>
   sealListedUploads(
      serverId,
      scope.bucket,
      await walkUploadsInFolders(scope, folders, query)
   );

const STALE_LISTING =
   "This upload can't be cancelled from this list any more. Refresh it and try again.";
const UNCANCELLABLE =
   "This upload's id is too long to cancel here. Cancel it with your storage provider's tools.";

const abortMultipartUploads = async (
   { client, bucket, signal }: S3Scope,
   serverId: string,
   uploads: readonly S3UploadRef[]
): Promise<S3AbortUploadsResult & { alreadyGone: S3UploadRef[] }> => {
   const once = withoutRetries(client);
   const outcomes = await mapLimit(
      uploads,
      ABORT_CONCURRENCY,
      async ({ key, uploadId }): Promise<S3UploadFailure | "gone" | null> => {
         let stored: string;
         try {
            stored = cancellableUploadId(uploadId, { serverId, bucket, key });
         } catch {
            return {
               key,
               uploadId,
               message: isUnusableUploadId(uploadId)
                  ? UNCANCELLABLE
                  : STALE_LISTING,
            };
         }
         try {
            await once.send(
               new AbortMultipartUploadCommand({
                  Bucket: bucket,
                  Key: key,
                  UploadId: stored,
               }),
               { abortSignal: signal }
            );
            return null;
         } catch (error) {
            if (isNotFound(error)) return "gone";
            return { key, uploadId, message: toHttpError(error).message };
         }
      }
   );
   const refs = (outcome: S3UploadFailure | "gone" | null): S3UploadRef[] =>
      uploads.flatMap(({ key, uploadId }, index) =>
         outcomes[index] === outcome ? [{ key, uploadId }] : []
      );
   return {
      aborted: refs(null),
      alreadyGone: refs("gone"),
      failed: outcomes.filter(
         (outcome) => outcome !== null && outcome !== "gone"
      ),
   };
};

const asConflict = conflictAs(uploadConflictError, uploadConflict);

const abortUpload = async (
   { client, bucket, signal }: S3Scope,
   key: string,
   uploadId: string
): Promise<boolean> => {
   try {
      await withDeadline(signal, CLEANUP_TIMEOUT_MS, (deadline) =>
         client.send(
            new AbortMultipartUploadCommand({
               Bucket: bucket,
               Key: key,
               UploadId: uploadId,
            }),
            { abortSignal: deadline }
         )
      );
      return true;
   } catch (error) {
      if (isNotFound(error)) return false;
      return throwHttpError(error);
   }
};

const abortMultipartUpload = (
   scope: S3Scope,
   key: string,
   uploadId: string
): Promise<boolean> =>
   abortUpload({ ...scope, client: forCancel(scope.client) }, key, uploadId);

const abortForCleanup = async (
   { client, bucket }: S3Scope,
   key: string,
   uploadId: string
): Promise<void> => {
   try {
      await abortUpload({ client: forCleanup(client), bucket }, key, uploadId);
   } catch {
      logger.warn("Multipart upload could not be aborted", {
         bucket,
         keyHash: keyHash(key),
         keyLength: key.length,
         uploadId,
      });
   }
};

type CreateUploadParams = {
   serverId: string;
   key: string;
   contentType: string;
   partSize: number;
   partCount: number;
   expectedETag?: string;
};

type UploadBinding = { serverId: string; bucket: string; key: string };

const PLAN_PREFIX = "m3~";
const LISTED_PREFIX = "l1~";
const UNUSABLE_PREFIX = `${LISTED_PREFIX}~`;
const unusableUploadId = (key: string, uploadId: string): string =>
   `${UNUSABLE_PREFIX}${createHash("sha256").update(`${key}\0${uploadId}`).digest("base64url")}`;
const isUnusableUploadId = (value: string): boolean =>
   value.length > UNUSABLE_PREFIX.length && value.startsWith(UNUSABLE_PREFIX);
const planSigner = signer("s3-viewer multipart plan");

const bound = (body: string, { serverId, bucket, key }: UploadBinding) =>
   `${createHash("sha256")
      .update(JSON.stringify([serverId, bucket, key]))
      .digest("base64url")}~${body}`;

type ReplacementPlan = { expectedETag: string; settingsDigest: string };

const sealBody = (body: string, binding: UploadBinding): string | undefined => {
   const sealed = `${body}~${planSigner.sign(bound(body, binding))}`;
   return sealed.length <= MAX_UPLOAD_ID_CHARS ? sealed : undefined;
};

const sealUploadId = (
   uploadId: string,
   partSize: number,
   binding: UploadBinding,
   replacement?: ReplacementPlan
): string | undefined => {
   const snapshot = Buffer.from(
      JSON.stringify([
         replacement?.expectedETag ?? null,
         replacement?.settingsDigest ?? null,
      ])
   ).toString("base64url");
   return sealBody(
      `${PLAN_PREFIX}${partSize}~${snapshot}~${uploadId}`,
      binding
   );
};

const sealListedUpload = (
   uploadId: string,
   binding: UploadBinding
): string | undefined => sealBody(`${LISTED_PREFIX}${uploadId}`, binding);

type UploadPlan = {
   uploadId: string;
   partSize: number;
   expectedETag?: string;
   settingsDigest?: string;
};

const invalidUploadId = (): ApiHttpError =>
   new ApiHttpError(
      400,
      "This upload id is not valid. Start the upload again."
   );

const verifiedBody = (value: string, binding: UploadBinding): string => {
   const cut = value.lastIndexOf("~");
   const body = value.slice(0, cut);
   if (!planSigner.verify(bound(body, binding), value.slice(cut + 1)))
      throw invalidUploadId();
   return body;
};

const openUploadId = (value: string, binding: UploadBinding): UploadPlan => {
   if (!value.startsWith(PLAN_PREFIX)) throw invalidUploadId();
   const body = verifiedBody(value, binding);
   const rest = body.slice(PLAN_PREFIX.length);
   const split = rest.indexOf("~");
   const partSize = Number(rest.slice(0, split));
   if (split < 0 || !Number.isSafeInteger(partSize) || partSize <= 0)
      throw invalidUploadId();
   const payload = rest.slice(split + 1);
   const snapshotEnd = payload.indexOf("~");
   const uploadId = payload.slice(snapshotEnd + 1);
   if (snapshotEnd < 0 || !uploadId) throw invalidUploadId();
   let snapshot: unknown;
   try {
      snapshot = JSON.parse(
         Buffer.from(payload.slice(0, snapshotEnd), "base64url").toString()
      );
   } catch {
      throw invalidUploadId();
   }
   if (!Array.isArray(snapshot) || snapshot.length !== 2)
      throw invalidUploadId();
   const [expectedETag, settingsDigest] = snapshot as unknown[];
   if (expectedETag === null && settingsDigest === null)
      return { uploadId, partSize };
   if (
      typeof expectedETag !== "string" ||
      !expectedETag ||
      typeof settingsDigest !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(settingsDigest)
   )
      throw invalidUploadId();
   return { uploadId, partSize, expectedETag, settingsDigest };
};

const cancellableUploadId = (value: string, binding: UploadBinding): string => {
   if (!value.startsWith(LISTED_PREFIX))
      return openUploadId(value, binding).uploadId;
   const uploadId = verifiedBody(value, binding).slice(LISTED_PREFIX.length);
   if (!uploadId) throw invalidUploadId();
   return uploadId;
};

const createUpload = async (
   scope: S3Scope,
   provider: Provider,
   {
      serverId,
      key,
      contentType,
      partSize,
      partCount,
      expectedETag,
   }: CreateUploadParams
): Promise<S3MultipartCreated> => {
   const { settings, attributes } = await prepareUpload(scope, provider, {
      key,
      contentType,
      expectedETag,
   }).catch(asConflict);
   const command = new CreateMultipartUploadCommand({
      Bucket: scope.bucket,
      Key: key,
      ...attributes,
   });
   if (provider !== Provider.S3)
      conditionalInitiation(command, writeCondition(expectedETag));
   const created = await scope.client
      .send(command, { abortSignal: scope.signal })
      .catch(asConflict);
   if (!created.UploadId)
      throw new ApiHttpError(502, "Storage returned no upload id.");
   const uploadId = sealUploadId(
      created.UploadId,
      partSize,
      { serverId, bucket: scope.bucket, key },
      settings && expectedETag !== undefined
         ? { expectedETag, settingsDigest: replacementSettingsDigest(settings) }
         : undefined
   );
   if (!uploadId) {
      await abortForCleanup(scope, key, created.UploadId);
      throw new ApiHttpError(
         502,
         "Storage issued an upload id this instance cannot carry."
      );
   }
   return { key, uploadId, partSize, partCount };
};

type PartParams = {
   key: string;
   uploadId: string;
   partNumber: number;
   body: Readable;
   contentLength: number;
   abortController: AbortController;
   idleTimeoutMs: number;
};

const streamPart = async (
   { client, bucket }: S3Scope,
   {
      key,
      uploadId,
      partNumber,
      body,
      contentLength,
      abortController,
      idleTimeoutMs,
   }: PartParams
): Promise<S3UploadedPart> => {
   const once = withoutRetries(client);
   const guard = floorGuard(
      abortController,
      idleTimeoutMs,
      body,
      contentLength
   );
   const onBodyError = (error: Error) => guard.destroy(error);
   // passing a destroy reason can strand an SDK chunked-encoder rejection; recover it from the signal below.
   const onAbort = () => guard.destroy();
   body.on("error", onBodyError);
   // destruction before SDK attachment still needs an error listener.
   guard.on("error", noop);
   abortController.signal.addEventListener("abort", onAbort, { once: true });
   try {
      if (abortController.signal.aborted) onAbort();
      const stored = await once.send(
         new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: body.pipe(guard),
            ContentLength: contentLength,
         }),
         { abortSignal: abortController.signal }
      );
      if (!stored.ETag)
         throw new ApiHttpError(502, "Storage returned no part ETag.");
      return { partNumber, eTag: stored.ETag, size: contentLength };
   } catch (error) {
      const { reason } = abortController.signal;
      if (
         reason instanceof UploadIdleError ||
         reason instanceof StorageStalledError
      )
         throw reason;
      return throwHttpError(error);
   } finally {
      body.off("error", onBodyError);
      abortController.signal.removeEventListener("abort", onAbort);
      body.unpipe(guard);
      guard.destroy();
   }
};

const listUploadedParts = async (
   { client, bucket, signal }: S3Scope,
   key: string,
   uploadId: string
): Promise<S3UploadedPart[]> => {
   const parts: S3UploadedPart[] = [];
   let marker: string | undefined;
   return retainedRead(budgetServerOf(client), async (reservation) => {
      for (let page = 0; page < MAX_PART_PAGES; page++) {
         const listed = await client
            .send(
               new ListPartsCommand({
                  Bucket: bucket,
                  Key: key,
                  UploadId: uploadId,
                  MaxParts: S3_MAX_KEYS_PER_REQUEST,
                  PartNumberMarker: marker,
               }),
               { abortSignal: signal }
            )
            .catch(throwHttpError);
         try {
            for (const part of listed.Parts ?? []) {
               if (part.PartNumber === undefined || !part.ETag) continue;
               reservation.retain(
                  BUFFER_MEMORY_FACTOR *
                     (part.ETag.length * 2 + PART_MEMORY_OVERHEAD_BYTES)
               );
               parts.push({
                  partNumber: part.PartNumber,
                  eTag: copyRetainedString(part.ETag),
                  size: part.Size ?? 0,
               });
            }
            if (listed.IsTruncated !== true) break;
            const next =
               listed.NextPartNumberMarker ??
               String(parts.at(-1)?.partNumber ?? "");
            if (!next || next === marker) break;
            reservation.retain(next.length * 2);
            marker = copyRetainedString(next);
         } finally {
            releaseBufferedResponse(listed);
         }
      }
      parts.sort((left, right) => left.partNumber - right.partNumber);
      return parts;
   });
};

type DeclaredPart = { partNumber: number; eTag: string };

const assertPartsAgree = (
   declared: readonly DeclaredPart[],
   stored: readonly S3UploadedPart[]
): void => {
   const agrees =
      declared.length === stored.length &&
      stored.every(
         (part, index) =>
            part.partNumber === index + 1 &&
            part.partNumber === declared[index]?.partNumber &&
            part.eTag === declared[index]?.eTag
      );
   if (!agrees)
      throw new ApiHttpError(
         409,
         "The uploaded parts no longer match this file. Start the upload again."
      );
};

type CompleteUploadParams = {
   serverId: string;
   key: string;
   uploadId: string;
   parts: readonly DeclaredPart[];
   expectedETag?: string;
   maxBytes: number;
   commitSignal?: (size: number) => AbortSignal;
};

const completeUpload = async (
   scope: S3Scope,
   {
      serverId,
      key,
      uploadId: sealedUploadId,
      parts,
      expectedETag,
      maxBytes,
      commitSignal,
   }: CompleteUploadParams
): Promise<S3ObjectUploaded> => {
   const plan = openUploadId(sealedUploadId, {
      serverId,
      bucket: scope.bucket,
      key,
   });
   const { uploadId } = plan;
   if (plan.expectedETag !== expectedETag) {
      await abortForCleanup(scope, key, uploadId);
      throw new ApiHttpError(
         409,
         "This upload's write condition changed. Start the upload again."
      );
   }
   const stored = await listUploadedParts(scope, key, uploadId);
   assertPartsAgree(parts, stored);
   const size = stored.reduce((total, part) => total + part.size, 0);
   if (size > maxBytes) {
      await abortForCleanup(scope, key, uploadId);
      throw uploadTooLarge(maxBytes);
   }
   try {
      if (plan.expectedETag !== undefined) {
         const current = await readReplacementSettings(
            scope,
            key,
            plan.expectedETag
         ).catch(asConflict);
         if (replacementSettingsDigest(current) !== plan.settingsDigest)
            throw new ApiHttpError(
               409,
               "The file's settings changed. Refresh and confirm the replacement again."
            );
      } else if (!enforcesConditions(await clientProvider(scope.client)))
         await assertDestinationAbsent(scope, key, UPLOAD_CONFLICT);
   } catch (error) {
      if (
         error instanceof ApiHttpError &&
         (error.status === 409 || error.status === 404)
      )
         await abortForCleanup(scope, key, uploadId);
      throw error;
   }
   const completed = await withoutRetries(scope.client)
      .send(
         new CompleteMultipartUploadCommand({
            Bucket: scope.bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
               Parts: stored.map(({ partNumber, eTag }) => ({
                  PartNumber: partNumber,
                  ETag: eTag,
               })),
            },
            ...writeCondition(plan.expectedETag),
         }),
         { abortSignal: commitSignal?.(size) ?? scope.signal }
      )
      .catch(async (error: unknown) => {
         // preserve parts after transient completion failures so the caller can retry without re-uploading.
         if (!uploadConflict(error)) return throwHttpError(error);
         await abortForCleanup(scope, key, uploadId);
         throw uploadConflictError();
      });
   return { key, size, eTag: completed.ETag ?? null };
};

export {
   abortForCleanup,
   abortMultipartUpload,
   abortMultipartUploads,
   completeUpload,
   createUpload,
   listMultipartUploads,
   listUploadsInFolders,
   listUploadedParts,
   openUploadId,
   sealListedUpload,
   sealUploadId,
   streamPart,
};
