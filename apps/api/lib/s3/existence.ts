import { MAX_EXISTS_HEADS } from "@/lib/constants";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { mapLimit, type S3ObjectsExist } from "@s3-viewer/types";
import { isNotFound, throwHttpError } from "./errors";
import { existingKeys, type S3Scope } from "./listing";

const HEAD_CONCURRENCY = 16;
const EXISTS_LIST_THRESHOLD = 50;

const headExisting = async (
   { client, bucket, signal }: S3Scope,
   keys: readonly string[]
): Promise<S3ObjectsExist> => {
   const found = await mapLimit(keys, HEAD_CONCURRENCY, async (key) => {
      try {
         const head = await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: key }),
            { abortSignal: signal }
         );
         return { key, eTag: head.ETag };
      } catch (error) {
         if (isNotFound(error)) return null;
         throwHttpError(error);
      }
   });
   return {
      existing: found.flatMap((object) => (object ? [object.key] : [])),
      eTags: Object.fromEntries(
         found.flatMap((object) =>
            object?.eTag ? [[object.key, object.eTag]] : []
         )
      ),
   };
};

// Keep the request's listing/HEAD budget. Unresolved keys have no ETag and
// cannot authorize replacement; the caller must check a smaller batch.
const whichExist = async (
   scope: S3Scope,
   keys: string[]
): Promise<S3ObjectsExist> => {
   if (keys.length <= EXISTS_LIST_THRESHOLD) return headExisting(scope, keys);
   const { existing, eTags, unresolved } = await existingKeys(scope, keys);
   const headed = await headExisting(
      scope,
      unresolved.slice(0, MAX_EXISTS_HEADS)
   );
   return {
      existing: [
         ...existing,
         ...headed.existing,
         ...unresolved.slice(MAX_EXISTS_HEADS),
      ],
      eTags: { ...eTags, ...headed.eTags },
   };
};

export { whichExist };
