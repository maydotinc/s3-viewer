import {
   ListObjectsV2Command,
   type ListObjectsV2CommandInput,
   type S3Client,
} from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   foldersLeadingToScope,
   observedETagSchema,
   isFolderKey,
   parentPrefix,
   prefixHasDotSegment,
   type S3KeysPage,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import { logger } from "@/lib/logger";
import { ApiHttpError } from "@/lib/http";
import { throwBucketError } from "./errors";
import {
   compareUtf8,
   decodeOptionalKey,
   justBefore,
   utf8Before,
   withoutLoneSurrogate,
} from "./keys";
import {
   releaseBufferedResponse,
   transferBufferedResponse,
} from "./response-collector";
import {
   copyRetainedString,
   retainedRead,
   type ReadReservation,
} from "./read-budget";
import { budgetServerOf } from "./request-budget";

const MAX_CALLS_PER_PAGE = 20;
const MAX_EXISTS_PAGES = 20;
// above this many keys one listing page answers faster than a HEAD per key.
const EXISTS_LIST_THRESHOLD = 50;
const LISTED_ROW_OVERHEAD_BYTES = 128;

type S3Scope = { client: S3Client; bucket: string; signal?: AbortSignal };

// a listed page stays reserved only until its rows are copied out, so a slow reader of the
// JSON response holds the few KiB of rows and not the whole XML document behind them.
const retainRow = (
   reservation: ReadReservation,
   ...values: (string | undefined)[]
): void =>
   reservation.retain(
      2 * values.reduce((total, value) => total + (value?.length ?? 0), 0) +
         LISTED_ROW_OVERHEAD_BYTES
   );

const listObjects = async (
   { client, bucket, signal }: S3Scope,
   input: Omit<ListObjectsV2CommandInput, "Bucket" | "EncodingType">
) => {
   const page = await client
      .send(
         new ListObjectsV2Command({
            ...input,
            Bucket: bucket,
            EncodingType: "url",
         }),
         { abortSignal: signal }
      )
      .catch(throwBucketError);
   if (page.EncodingType !== "url") return page;
   return transferBufferedResponse(page, {
      ...page,
      Contents: page.Contents?.map((object) => ({
         ...object,
         Key: decodeOptionalKey(object.Key),
      })),
      CommonPrefixes: page.CommonPrefixes?.map((common) => ({
         ...common,
         Prefix: decodeOptionalKey(common.Prefix),
      })),
   });
};

type ListPageArgs = S3Scope & {
   prefix: string;
   continuationToken?: string;
   blockSize: number;
};

const mergeByKey = (a: S3Object[], b: S3Object[]): S3Object[] => {
   const out: S3Object[] = [];
   let i = 0;
   let j = 0;
   for (let x = a[i], y = b[j]; x && y; x = a[i], y = b[j]) {
      if (utf8Before(x.key, y.key)) {
         out.push(x);
         i++;
      } else {
         out.push(y);
         j++;
      }
   }
   return out.concat(a.slice(i), b.slice(j));
};

const listPage = async ({
   client,
   bucket,
   signal,
   prefix,
   continuationToken,
   blockSize,
}: ListPageArgs): Promise<S3ObjectListPage> => {
   const folders: S3Object[] = [];
   const objects: S3Object[] = [];
   const seenTokens = new Set<string>();
   let token = continuationToken;

   return retainedRead(budgetServerOf(client), async (reservation) => {
      for (let calls = 0; calls < MAX_CALLS_PER_PAGE; calls++) {
         if (token) seenTokens.add(token);
         const remaining = blockSize - (folders.length + objects.length);
         const page = await listObjects(
            { client, bucket, signal },
            {
               Prefix: prefix || undefined,
               Delimiter: "/",
               MaxKeys: Math.max(
                  1,
                  Math.min(S3_MAX_KEYS_PER_REQUEST, remaining)
               ),
               ContinuationToken: token,
            }
         );

         try {
            // a gateway that ignores Prefix must not widen what a folder-limited grant can see.
            for (const common of page.CommonPrefixes ?? []) {
               if (common.Prefix?.startsWith(prefix)) {
                  retainRow(reservation, common.Prefix);
                  folders.push(folderRow(copyRetainedString(common.Prefix)));
               }
            }
            for (const object of page.Contents ?? []) {
               if (
                  !object.Key?.startsWith(prefix) ||
                  (isFolderKey(prefix) && object.Key === prefix)
               )
                  continue;
               retainRow(reservation, object.Key, object.ETag);
               objects.push({
                  key: copyRetainedString(object.Key),
                  isFolder: false,
                  eTag: object.ETag ? copyRetainedString(object.ETag) : null,
                  lastModified: object.LastModified?.toISOString() ?? null,
                  size: object.Size ?? null,
               });
            }
            token = page.IsTruncated
               ? page.NextContinuationToken &&
                 copyRetainedString(page.NextContinuationToken)
               : undefined;
         } finally {
            releaseBufferedResponse(page);
         }

         if (!token) break;
         if (seenTokens.has(token)) {
            logger.warn(
               "S3 listing returned a repeated continuation token; ending page"
            );
            token = undefined;
            break;
         }
         if (folders.length + objects.length >= blockSize) break;
      }

      return {
         objects: mergeByKey(folders, objects),
         nextToken: token ?? null,
      };
   });
};

const folderRow = (key: string): S3Object => ({
   key,
   isFolder: true,
   eTag: null,
   lastModified: null,
   size: null,
});

const pathToFoldersPage = (
   folders: readonly string[],
   prefix: string
): S3ObjectListPage => ({
   objects: foldersLeadingToScope(folders, prefix).map(folderRow),
   nextToken: null,
});

const nextListToken = (
   page: { IsTruncated?: boolean; NextContinuationToken?: string },
   token: string | undefined
): string | undefined => {
   const next = page.IsTruncated ? page.NextContinuationToken : undefined;
   if (page.IsTruncated && (!next || next === token)) {
      throw new ApiHttpError(
         502,
         "Storage returned an incomplete folder listing. Refresh before trying again."
      );
   }
   return next;
};

const listKeysPage = async (
   { client, bucket, signal }: S3Scope,
   prefix: string,
   continuationToken: string | undefined
): Promise<S3KeysPage> =>
   retainedRead(budgetServerOf(client), async (reservation) => {
      const page = await listObjects(
         { client, bucket, signal },
         {
            Prefix: prefix,
            MaxKeys: S3_MAX_KEYS_PER_REQUEST,
            ContinuationToken: continuationToken,
         }
      );
      try {
         const nextToken = nextListToken(page, continuationToken);
         return {
            objects: (page.Contents ?? []).flatMap((object) => {
               if (!object.Key?.startsWith(prefix)) return [];
               const eTag = observedETagSchema.safeParse(object.ETag).success
                  ? object.ETag!
                  : null;
               retainRow(reservation, object.Key, eTag ?? undefined);
               return [
                  {
                     key: copyRetainedString(object.Key),
                     size: object.Size ?? null,
                     expectedETag: eTag && copyRetainedString(eTag),
                  },
               ];
            }),
            nextToken: nextToken ? copyRetainedString(nextToken) : null,
         };
      } finally {
         releaseBufferedResponse(page);
      }
   });

type ExistingKeys = {
   existing: string[];
   eTags: Record<string, string>;
   sizes: Record<string, number>;
   unresolved: string[];
};

const commonPrefix = (keys: readonly string[]): string => {
   let prefix = keys[0] ?? "";
   for (const key of keys) {
      let i = 0;
      while (i < prefix.length && key[i] === prefix[i]) i++;
      prefix = prefix.slice(0, i);
      if (prefix === "") break;
   }
   return withoutLoneSurrogate(prefix);
};

const laterOf = (a: string, b: string): string => (utf8Before(a, b) ? b : a);

const existingKeys = async (
   { client, bucket, signal }: S3Scope,
   keys: readonly string[]
): Promise<ExistingKeys> => {
   const wanted = new Set(keys);
   const sorted = [...wanted].sort(compareUtf8);
   // keys named "..a" and "..b" share "..", which reads as the parent folder.
   const shared = commonPrefix(sorted);
   const prefix = prefixHasDotSegment(shared) ? parentPrefix(shared) : shared;
   const existing: string[] = [];
   const eTags: Record<string, string> = Object.create(null);
   const sizes: Record<string, number> = Object.create(null);
   let cursor = "";
   let i = 0;

   return retainedRead(budgetServerOf(client), async (reservation) => {
      for (
         let calls = 0;
         calls < MAX_EXISTS_PAGES && i < sorted.length;
         calls++
      ) {
         const startAfter = laterOf(cursor, justBefore(sorted[i]!));
         const page = await listObjects(
            { client, bucket, signal },
            {
               Prefix: prefix || undefined,
               MaxKeys: S3_MAX_KEYS_PER_REQUEST,
               StartAfter: startAfter || undefined,
            }
         );

         try {
            let last: string | undefined;
            for (const object of page.Contents ?? []) {
               if (!object.Key) continue;
               last = object.Key;
               if (wanted.has(object.Key)) {
                  retainRow(reservation, object.Key, object.ETag);
                  const key = copyRetainedString(object.Key);
                  existing.push(key);
                  if (object.ETag) eTags[key] = copyRetainedString(object.ETag);
                  if (object.Size !== undefined) sizes[key] = object.Size;
               }
            }
            if (!page.IsTruncated) {
               i = sorted.length;
               break;
            }
            if (last === undefined) break;
            cursor = copyRetainedString(last);
            while (i < sorted.length && !utf8Before(last, sorted[i]!)) i++;
         } finally {
            releaseBufferedResponse(page);
         }
      }

      return { existing, eTags, sizes, unresolved: sorted.slice(i) };
   });
};

export {
   EXISTS_LIST_THRESHOLD,
   existingKeys,
   listKeysPage,
   listObjects,
   listPage,
   nextListToken,
   pathToFoldersPage,
};
export type { S3Scope };
