import {
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   ListPartsCommand,
   UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
   MAX_MULTIPART_PARTS,
   Provider,
   S3_MAX_KEYS_PER_REQUEST,
   type S3MultipartCreated,
   type S3ObjectUploaded,
   type S3UploadedPart,
} from "@s3-viewer/shared";
import { type Readable } from "node:stream";
import { UPLOAD_CONFLICT } from "@/lib/constants";
import { noop } from "@/lib/utils/abort";
import { rethrowFailure, storageFailure } from "./classify";
import {
   assertDestinationAbsent,
   conditionalInitiation,
   conflictAs,
   enforcesConditions,
   unconfirmedOnceSent,
   isUploadConflict,
   uploadConflict,
   writeCondition,
} from "./conditions";
import { requirePartETag, StorageError, uploadTooLarge } from "./errors";
import type { S3Scope } from "./listing";
import { abortForCleanup } from "./multipart-abort";
import { withoutRetries } from "./no-retry";
import { clientProvider } from "./provider";
import { floorGuard, isStalled } from "./progress-floor";
import {
   BUFFER_MEMORY_FACTOR,
   copyRetainedString,
   retainedRead,
} from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { withReleased } from "./response-collector";
import {
   prepareUpload,
   readReplacementSettings,
   replacementSettingsDigest,
   settingsChanged,
} from "./replacement-settings";
import { openUploadId, sealUploadId } from "./upload-id";

const MAX_PART_PAGES = Math.ceil(MAX_MULTIPART_PARTS / S3_MAX_KEYS_PER_REQUEST);
const PART_MEMORY_OVERHEAD_BYTES = 128;

const asConflict = conflictAs(uploadConflict, isUploadConflict);

type CreateUploadParams = {
   serverId: string;
   key: string;
   contentType: string;
   partSize: number;
   partCount: number;
   expectedETag?: string;
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
      throw new StorageError("upstream", "Storage returned no upload id.");
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
      throw new StorageError(
         "upstream",
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
      return {
         partNumber,
         eTag: requirePartETag(stored.ETag),
         size: contentLength,
      };
   } catch (error) {
      const { reason } = abortController.signal;
      if (isStalled(reason)) throw reason;
      throw storageFailure(error);
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
            .catch(rethrowFailure());
         const done = withReleased(listed, () => {
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
            if (listed.IsTruncated !== true) return true;
            const next =
               listed.NextPartNumberMarker ??
               String(parts.at(-1)?.partNumber ?? "");
            if (!next || next === marker) return true;
            reservation.retain(next.length * 2);
            marker = copyRetainedString(next);
            return false;
         });
         if (done) break;
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
      throw new StorageError(
         "conflict",
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
      throw new StorageError(
         "conflict",
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
            throw settingsChanged();
      } else if (!enforcesConditions(await clientProvider(scope.client)))
         await assertDestinationAbsent(scope, key, UPLOAD_CONFLICT);
   } catch (error) {
      if (
         error instanceof StorageError &&
         (error.kind === "conflict" || error.kind === "notFound")
      )
         await abortForCleanup(scope, key, uploadId);
      throw error;
   }
   const complete = new CompleteMultipartUploadCommand({
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
   });
   const unconfirmed = unconfirmedOnceSent(complete);
   const completed = await withoutRetries(scope.client)
      .send(complete, { abortSignal: commitSignal?.(size) ?? scope.signal })
      .catch(async (error: unknown) => {
         // preserve parts after transient completion failures so the caller can retry without re-uploading.
         if (!isUploadConflict(error)) throw storageFailure(unconfirmed(error));
         await abortForCleanup(scope, key, uploadId);
         throw uploadConflict();
      });
   return { key, size, eTag: completed.ETag ?? null };
};

export { completeUpload, createUpload, listUploadedParts, streamPart };
