import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   isFolderKey,
   type S3KeysPage,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import { logger } from "../logger";
import { throwBucketError } from "./errors";
const MAX_CALLS_PER_PAGE = 20;
const MAX_EXISTS_PAGES = 20;

type ListPageArgs = {
   client: S3Client;
   bucket: string;
   prefix: string;
   continuationToken?: string;
   blockSize: number;
};

const utf8Before = (a: string, b: string): boolean =>
   Buffer.compare(Buffer.from(a), Buffer.from(b)) < 0;

// both inputs arrive in s3's utf-8 byte order, so one merge keeps global key order
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
   prefix,
   continuationToken,
   blockSize,
}: ListPageArgs): Promise<S3ObjectListPage> => {
   const folders: S3Object[] = [];
   const objects: S3Object[] = [];
   const seenTokens = new Set<string>();
   let token = continuationToken;

   for (let calls = 0; calls < MAX_CALLS_PER_PAGE; calls++) {
      if (token) seenTokens.add(token);
      const remaining = blockSize - (folders.length + objects.length);
      const page = await client
         .send(
            new ListObjectsV2Command({
               Bucket: bucket,
               Prefix: prefix || undefined,
               Delimiter: "/",
               MaxKeys: Math.max(
                  1,
                  Math.min(S3_MAX_KEYS_PER_REQUEST, remaining)
               ),
               ContinuationToken: token,
            })
         )
         .catch(throwBucketError);

      for (const common of page.CommonPrefixes ?? []) {
         if (common.Prefix) {
            folders.push({
               key: common.Prefix,
               isFolder: true,
               lastModified: null,
               size: null,
            });
         }
      }
      for (const object of page.Contents ?? []) {
         if (!object.Key || (isFolderKey(prefix) && object.Key === prefix))
            continue;
         objects.push({
            key: object.Key,
            isFolder: false,
            lastModified: object.LastModified?.toISOString() ?? null,
            size: object.Size ?? null,
         });
      }

      token = page.IsTruncated ? page.NextContinuationToken : undefined;
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

   return { objects: mergeByKey(folders, objects), nextToken: token ?? null };
};

const listKeysPage = async (
   client: S3Client,
   bucket: string,
   prefix: string,
   continuationToken: string | undefined
): Promise<S3KeysPage> => {
   const page = await client
      .send(
         new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: S3_MAX_KEYS_PER_REQUEST,
            ContinuationToken: continuationToken,
         })
      )
      .catch(throwBucketError);
   const nextToken = page.IsTruncated ? page.NextContinuationToken : undefined;
   return {
      keys: (page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : [])),
      nextToken: nextToken === continuationToken ? null : (nextToken ?? null),
   };
};

type ExistingKeys = { existing: string[]; unresolved: string[] };

// a cut between the halves of a surrogate pair leaves a lone unit that cannot be
// utf-8 encoded, so s3 would receive u+fffd and match nothing
const withoutLoneSurrogate = (value: string): string => {
   const tail = value.charCodeAt(value.length - 1);
   return tail >= 0xd800 && tail <= 0xdbff ? value.slice(0, -1) : value;
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

// any proper prefix of a key sorts before it
const justBefore = (key: string): string =>
   withoutLoneSurrogate(key.slice(0, -1));

// walks the keys in s3's own order: each page decides every key up to its last,
// and whatever the page budget doesn't reach comes back unresolved for the
// caller to head individually
const existingKeys = async (
   client: S3Client,
   bucket: string,
   keys: readonly string[]
): Promise<ExistingKeys> => {
   const wanted = new Set(keys);
   const sorted = [...wanted].sort((a, b) => (utf8Before(a, b) ? -1 : 1));
   const prefix = commonPrefix(sorted);
   const existing: string[] = [];
   let cursor = "";
   let i = 0;

   for (let calls = 0; calls < MAX_EXISTS_PAGES && i < sorted.length; calls++) {
      const next = sorted[i];
      const startAfter = laterOf(
         cursor,
         next === undefined ? "" : justBefore(next)
      );
      const page = await client
         .send(
            new ListObjectsV2Command({
               Bucket: bucket,
               Prefix: prefix || undefined,
               MaxKeys: S3_MAX_KEYS_PER_REQUEST,
               StartAfter: startAfter || undefined,
            })
         )
         .catch(throwBucketError);

      let last: string | undefined;
      for (const object of page.Contents ?? []) {
         if (!object.Key) continue;
         last = object.Key;
         if (wanted.has(object.Key)) existing.push(object.Key);
      }
      if (!page.IsTruncated) {
         i = sorted.length;
         break;
      }
      if (last === undefined) break;
      cursor = last;
      while (i < sorted.length && !utf8Before(last, sorted[i] ?? last)) i++;
   }

   return { existing, unresolved: sorted.slice(i) };
};

export { existingKeys, listKeysPage, listPage };
