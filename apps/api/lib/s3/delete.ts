import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   chunk,
   type S3DeleteResult,
} from "@s3-viewer/types";
import { deleteFailureMessage } from "./classify";
import { throwHttpError } from "./errors";
import type { S3Scope } from "./listing";

const deleteBatch = async (
   { client, bucket, signal }: S3Scope,
   keys: string[]
): Promise<S3DeleteResult> => {
   const out = await client
      .send(
         new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
         }),
         { abortSignal: signal }
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
   scope: S3Scope,
   keys: readonly string[]
): Promise<S3DeleteResult> => {
   const result: S3DeleteResult = { deleted: [], failed: [] };
   for (const keyBatch of chunk(keys, S3_MAX_KEYS_PER_REQUEST)) {
      const batch = await deleteBatch(scope, keyBatch);
      result.deleted.push(...batch.deleted);
      result.failed.push(...batch.failed);
   }
   return result;
};

export { deleteKeys };
