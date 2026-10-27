import { MAX_BULK_RENAME_KEYS } from "@/lib/utils/s3/bulk-rename";
import { existingKeys } from "@/lib/utils/s3/key-exists";
import { walkPrefix } from "@/lib/utils/s3/walk-prefix";
import { isFolderKey, type S3DeleteTarget } from "@s3-viewer/shared";

type SourceSnapshot = {
   objects: S3DeleteTarget[];
   truncated: boolean;
};

type CollectInput = {
   path: string;
   targets: readonly S3DeleteTarget[];
   signal?: AbortSignal;
   onProgress?: (listed: number) => void;
};

const listPrefix = async (
   path: string,
   prefix: string,
   into: S3DeleteTarget[],
   signal?: AbortSignal,
   onProgress?: (listed: number) => void
): Promise<boolean> => {
   for await (const page of walkPrefix(path, prefix, signal)) {
      for (const object of page.objects) {
         if (isFolderKey(object.key)) continue;
         if (into.length >= MAX_BULK_RENAME_KEYS) return true;
         into.push(object);
      }
      onProgress?.(into.length);
   }
   return false;
};

const collectSources = async ({
   path,
   targets,
   signal,
   onProgress,
}: CollectInput): Promise<SourceSnapshot> => {
   const objects: S3DeleteTarget[] = [];
   const seen = new Set<string>();
   let truncated = false;
   for (const target of targets) {
      if (isFolderKey(target.key)) {
         truncated =
            (await listPrefix(path, target.key, objects, signal, onProgress)) ||
            truncated;
      } else if (objects.length >= MAX_BULK_RENAME_KEYS) truncated = true;
      else objects.push(target);
      if (truncated) break;
   }
   onProgress?.(objects.length);
   return {
      objects: objects.filter(({ key }) => {
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
      }),
      truncated,
   };
};

const findExisting = async (
   path: string,
   keys: readonly string[],
   signal?: AbortSignal
): Promise<string[]> => (await existingKeys({ path, keys, signal })).existing;

export { collectSources, findExisting };
