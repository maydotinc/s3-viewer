import { DeleteObjectsCommand, type S3Client } from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   chunk,
   type S3DeleteResult,
} from "@s3-viewer/types";
import { deleteFailureMessage } from "./classify";
import { throwHttpError } from "./errors";

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

export { deleteKeys };
