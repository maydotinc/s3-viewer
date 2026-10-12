import { HEAD_CONCURRENCY } from "@/lib/constants";
import {
   mapLimit,
   type FolderScope,
   type S3ObjectsExist,
} from "@s3-viewer/types";
import { outsideFolders } from "./folder-guard";
import { headIfExists } from "./head";
import { existingKeys, type S3Scope } from "./listing";

const EXISTS_LIST_THRESHOLD = 50;

const headExisting = async (
   scope: S3Scope,
   keys: readonly string[]
): Promise<S3ObjectsExist> => {
   const found = await mapLimit(keys, HEAD_CONCURRENCY, async (key) => {
      const head = await headIfExists(scope, key);
      return head && { key, eTag: head.ETag };
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

const listExisting = async (
   scope: S3Scope,
   keys: readonly string[]
): Promise<S3ObjectsExist> => {
   const { existing, eTags, unresolved } = await existingKeys(scope, keys);
   const headed = await headExisting(scope, unresolved);
   return {
      existing: [...existing, ...headed.existing],
      eTags: { ...eTags, ...headed.eTags },
   };
};

const whichExist = (scope: S3Scope, keys: string[]): Promise<S3ObjectsExist> =>
   keys.length <= EXISTS_LIST_THRESHOLD
      ? headExisting(scope, keys)
      : listExisting(scope, keys);

// a common-prefix listing could span keys outside the caller's folders, so list each folder.
const whichExistInFolders = async (
   scope: S3Scope,
   folders: FolderScope,
   keys: string[]
): Promise<S3ObjectsExist> => {
   if (folders === null || keys.length <= EXISTS_LIST_THRESHOLD)
      return whichExist(scope, keys);
   const byFolder = new Map<string, string[]>();
   for (const key of keys) {
      const folder = folders.find((held) => key.startsWith(held));
      if (folder === undefined) throw outsideFolders();
      const group = byFolder.get(folder);
      if (group) group.push(key);
      else byFolder.set(folder, [key]);
   }
   const found: S3ObjectsExist = { existing: [], eTags: Object.create(null) };
   for (const group of byFolder.values()) {
      const { existing, eTags } = await listExisting(scope, group);
      found.existing.push(...existing);
      Object.assign(found.eTags, eTags);
   }
   return found;
};

export { whichExist, whichExistInFolders };
