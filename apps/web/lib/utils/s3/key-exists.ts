import { api, cancelledError, objectsPath } from "@/lib/api";
import {
   MAX_BATCH_KEYS,
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   type S3ObjectsExist,
} from "@s3-viewer/types";

type ExistingKeysInput = {
   path: string;
   keys: readonly string[];
   signal?: AbortSignal;
   requireETags?: boolean;
};

type KeyCheck = {
   serverId: string;
   bucketName: string;
   objectKey: string;
   signal?: AbortSignal;
};

const UNPROTECTED_API =
   "Update the API before uploading. This server does not provide upload overwrite protection.";
const UNCHECKED_KEYS =
   "Some files could not be checked safely. Upload fewer files at a time and try again.";
const UNREADABLE_VERSION =
   "That key is taken, but its current version couldn't be read. Refresh the folder and try again.";

const eTagsOf = (page: S3ObjectsExist): Record<string, string> | null =>
   page.eTags && typeof page.eTags === "object" && !Array.isArray(page.eTags)
      ? page.eTags
      : null;

// never refresh an ETag on confirm: that could authorize overwriting a newer, unseen object.
const existingKeys = async ({
   path,
   keys,
   signal,
   requireETags = false,
}: ExistingKeysInput): Promise<S3ObjectsExist> => {
   const existing = new Set<string>();
   const eTags: Record<string, string> = Object.create(null);
   for (const batch of chunkKeys(
      [...new Set(keys)],
      MAX_BATCH_KEYS,
      MAX_BATCH_KEY_CHARS
   )) {
      if (signal?.aborted) throw cancelledError();
      const page = await api.post<S3ObjectsExist>(
         `${path}/exists`,
         { objectKeys: batch },
         signal
      );
      if (signal?.aborted) throw cancelledError();
      const known = eTagsOf(page);
      if (requireETags && !known) throw new Error(UNPROTECTED_API);
      const requested = new Set(batch);
      for (const key of page.existing) {
         if (!requested.has(key)) continue;
         const eTag =
            known && Object.hasOwn(known, key) ? known[key] : undefined;
         if (requireETags && !eTag) throw new Error(UNCHECKED_KEYS);
         existing.add(key);
         if (eTag) eTags[key] = eTag;
      }
   }
   return { existing: [...existing], eTags };
};

const occupiedBy = async ({
   serverId,
   bucketName,
   objectKey,
   signal,
}: KeyCheck): Promise<string | null> => {
   const { existing, eTags } = await existingKeys({
      path: objectsPath(serverId, bucketName),
      keys: [objectKey],
      signal,
   });
   if (!existing.includes(objectKey)) return null;
   const eTag = eTags[objectKey];
   if (!eTag) throw new Error(UNREADABLE_VERSION);
   return eTag;
};

export { existingKeys, occupiedBy };
