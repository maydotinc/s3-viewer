import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   isFolderKey,
   type S3KeysPage,
   type S3Object,
   type S3ObjectListPage,
} from "@s3-viewer/types";
import { logger } from "../logger";
import { throwHttpError } from "./errors";
const MAX_CALLS_PER_PAGE = 20;

type ListPageArgs = {
   client: S3Client;
   bucket: string;
   prefix: string;
   continuationToken?: string;
   blockSize: number;
};

const utf8Before = (a: string, b: string): boolean =>
   Buffer.compare(Buffer.from(a), Buffer.from(b)) < 0;

/** Both inputs arrive in S3's UTF-8 byte order, so one merge keeps the page in global key order. */
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
         .catch(throwHttpError);

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
      .catch(throwHttpError);
   const nextToken = page.IsTruncated ? page.NextContinuationToken : undefined;
   return {
      keys: (page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : [])),
      nextToken: nextToken === continuationToken ? null : (nextToken ?? null),
   };
};

export { listKeysPage, listPage };
