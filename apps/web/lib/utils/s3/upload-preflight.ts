import { api, cancelledError, objectsPath } from "@/lib/api";
import {
   MAX_BATCH_KEYS,
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   type S3ObjectsExist,
} from "@s3-viewer/types";

type UploadPreflight = {
   serverId: string;
   bucketName: string;
   keys: string[];
   signal: AbortSignal;
};

// These are the versions the user reviews. Never refresh an ETag when they
// confirm: doing so could authorize overwriting a newer, unseen object.
const checkUploadConflicts = async ({
   serverId,
   bucketName,
   keys,
   signal,
}: UploadPreflight): Promise<S3ObjectsExist> => {
   const existing = new Set<string>();
   const eTags: Record<string, string> = Object.create(null);
   for (const batch of chunkKeys(keys, MAX_BATCH_KEYS, MAX_BATCH_KEY_CHARS)) {
      if (signal.aborted) throw cancelledError();
      const page = await api.post<S3ObjectsExist>(
         `${objectsPath(serverId, bucketName)}/exists`,
         { objectKeys: batch },
         signal
      );
      if (signal.aborted) throw cancelledError();
      if (
         !page.eTags ||
         typeof page.eTags !== "object" ||
         Array.isArray(page.eTags)
      ) {
         throw new Error(
            "Update the API before uploading. This server does not provide upload overwrite protection."
         );
      }
      const requested = new Set(batch);
      for (const key of page.existing) {
         if (!requested.has(key)) continue;
         const eTag =
            page.eTags && Object.hasOwn(page.eTags, key)
               ? page.eTags[key]
               : undefined;
         if (!eTag) {
            throw new Error(
               "Some files could not be checked safely. Upload fewer files at a time and try again."
            );
         }
         existing.add(key);
         eTags[key] = eTag;
      }
   }
   return { existing: [...existing], eTags };
};

export { checkUploadConflicts };
