import { ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   isPrefixInFolderScope,
   type MultipartUploadsQuery,
   type S3MultipartUploadPage,
} from "@s3-viewer/shared";
import { logger } from "@/lib/logger";
import { rethrowFailure } from "./classify";
import { StorageError } from "./errors";
import {
   compareUtf8,
   decodeOptionalKey,
   justBefore,
   keyHash,
   utf8Before,
} from "./keys";
import { decodeListed, retainRow, type S3Scope } from "./listing";
import { clientSupportsMultipartPrefix } from "./provider";
import { copyRetainedString, retainedRead } from "./read-budget";
import { budgetServerOf } from "./request-budget";
import { withReleased } from "./response-collector";
import { sealListedUpload, unusableUploadId } from "./upload-id";

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
   return retainedRead(budgetServerOf(client), async (reservation) => {
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
         .catch(rethrowFailure("bucket"));
      return withReleased(page, () => {
         const encoded = page.EncodingType === "url";
         const uploads = encoded
            ? decodeListed(page.Uploads, "Key")
            : page.Uploads;
         const nextKeyMarker = encoded
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
         const nextUploadId = truncated
            ? (page.NextUploadIdMarker ?? fallback?.UploadId ?? null)
            : null;

         return {
            uploads: (uploads ?? []).flatMap(
               ({ Key, UploadId, Initiated, StorageClass }) => {
                  if (!Key || !UploadId || !Key.startsWith(prefix)) return [];
                  retainRow(reservation, Key, UploadId, StorageClass);
                  return [
                     {
                        key: copyRetainedString(Key),
                        uploadId: copyRetainedString(UploadId),
                        initiated: Initiated?.toISOString() ?? null,
                        storageClass: StorageClass
                           ? copyRetainedString(StorageClass)
                           : null,
                     },
                  ];
               }
            ),
            nextKeyMarker:
               truncated && nextKey !== null
                  ? copyRetainedString(nextKey)
                  : null,
            nextUploadIdMarker:
               nextUploadId === null ? null : copyRetainedString(nextUploadId),
         };
      });
   });
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
   { prefix, keyMarker, uploadIdMarker }: UploadsQuery
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
   throw new StorageError(
      "unavailable",
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

export { listMultipartUploads, listUploadsInFolders };
