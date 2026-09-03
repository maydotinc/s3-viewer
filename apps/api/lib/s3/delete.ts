import {
   DeleteObjectsCommand,
   ListObjectsV2Command,
   type S3Client,
} from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   chunk,
   type S3DeleteResult,
} from "@s3-viewer/types";
import { ApiHttpError } from "../http";
import { deleteFailureMessage } from "./classify";
import { throwHttpError } from "./errors";
const MAX_PREFIX_KEYS = 100_000;

const deleteBatch = async (
   client: S3Client,
   bucket: string,
   keys: string[]
): Promise<S3DeleteResult> => {
   const out = await client
      .send(
         new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
         })
      )
      .catch(throwHttpError);
   return {
      deleted: (out.Deleted ?? []).flatMap((d) => (d.Key ? [d.Key] : [])),
      failed: (out.Errors ?? []).flatMap((e) =>
         e.Key ? [{ key: e.Key, message: deleteFailureMessage(e.Code) }] : []
      ),
   };
};

const deleteKeys = async (
   client: S3Client,
   bucket: string,
   keys: readonly string[]
): Promise<S3DeleteResult> => {
   const result: S3DeleteResult = { deleted: [], failed: [] };
   for (const keyBatch of chunk(keys, S3_MAX_KEYS_PER_REQUEST)) {
      const batch = await deleteBatch(client, bucket, keyBatch);
      result.deleted.push(...batch.deleted);
      result.failed.push(...batch.failed);
   }
   return result;
};

const collectKeys = async (
   client: S3Client,
   bucket: string,
   prefix: string
): Promise<string[]> => {
   const keys: string[] = [];
   let token: string | undefined;
   do {
      const page = await client
         .send(
            new ListObjectsV2Command({
               Bucket: bucket,
               Prefix: prefix,
               MaxKeys: S3_MAX_KEYS_PER_REQUEST,
               ContinuationToken: token,
            })
         )
         .catch(throwHttpError);
      for (const object of page.Contents ?? []) {
         if (object.Key) keys.push(object.Key);
      }
      if (keys.length > MAX_PREFIX_KEYS) {
         throw new ApiHttpError(
            413,
            "Folder too large to delete in one request"
         );
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
   } while (token);
   return keys;
};

const deletePrefix = async (
   client: S3Client,
   bucket: string,
   prefix: string
): Promise<S3DeleteResult> =>
   deleteKeys(client, bucket, await collectKeys(client, bucket, prefix));

export { deleteKeys, deletePrefix };
