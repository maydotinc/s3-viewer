import {
   GIB,
   S3_MAX_KEYS_PER_REQUEST,
   baseName,
   isFolderKey,
   mapLimit,
   mapLimitAbortingSiblings,
   parentPrefix,
} from "@s3-viewer/shared";
import { HEAD_CONCURRENCY, S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { withDeadline } from "@/lib/utils/abort";
import { keyedSlots } from "@/lib/utils/keyed-slots";
import { headObject } from "../head";
import { assertObjectSize, keyHash } from "../keys";
import {
   EXISTS_LIST_THRESHOLD,
   existingKeys,
   listObjects,
   nextListToken,
   type S3Scope,
} from "../listing";
import { copyRetainedString, retainedRead } from "../read-budget";
import { budgetServerOf } from "../request-budget";
import { withReleased } from "../response-collector";
import { refusal, StorageError } from "../errors";

type ArchiveEntry = { key: string; name: string; size: number };
type ArchiveLimits = { maxObjects: number; maxBytes: number };

const ENTRY_MEMORY_OVERHEAD = 512;
// listing and naming a selection is CPU work, and ticket creation does it before any slot is held.
const MAX_CONCURRENT_COLLECTIONS = 4;
// one account or server may not hold the whole collection cap.
const MAX_TENANT_COLLECTIONS = 2;
// selected folders and listing groups are independent, and the in-flight caps already bound the requests.
const GROUP_CONCURRENCY = 4;
// folder markers and keys repeated by overlapping selections are listed but never become entries.
const EXAMINED_PER_ENTRY = 4;
// listings are one page of 1000 keys at best; stores that answer short pages get twice as many.
const PAGE_SLACK = 2;

type ManifestEntry = readonly [key: string, size: number];
type SignalScope = S3Scope & { signal: AbortSignal };

// the zip's own entry cap fixes how many keys may be examined, and so how many pages that takes:
// at the default 10,000 entries that is 40,000 keys, 80 pages, plus the last page of each selected prefix.
const listingBounds = (
   maxObjects: number,
   selected: number
): { examined: number; pages: number } => {
   const examined = maxObjects * EXAMINED_PER_ENTRY;
   return {
      examined,
      pages:
         Math.ceil(examined / S3_MAX_KEYS_PER_REQUEST) * PAGE_SLACK + selected,
   };
};

const gib = (bytes: number): string => `${(bytes / GIB).toFixed(1)} GiB`;

const parentOf = (key: string): string =>
   parentPrefix(isFolderKey(key) ? key.slice(0, -1) : key);

const inGroups = <T, R>(
   scope: SignalScope,
   groups: readonly T[],
   run: (scope: SignalScope, group: T) => Promise<R>
): Promise<R[]> =>
   mapLimitAbortingSiblings(
      groups,
      GROUP_CONCURRENCY,
      scope.signal,
      (group, signal) => run({ ...scope, signal }, group)
   );

const archiveRoot = (objectKeys: readonly string[]): string => {
   let root = objectKeys[0] === undefined ? "" : parentOf(objectKeys[0]);
   for (const key of objectKeys) {
      const parent = parentOf(key);
      while (root && !parent.startsWith(root)) {
         root = root.slice(0, root.lastIndexOf("/", root.length - 2) + 1);
      }
   }
   return root;
};

const archiveFilename = (
   bucket: string,
   objectKeys: readonly string[]
): string =>
   objectKeys.length === 1 && objectKeys[0] && isFolderKey(objectKeys[0])
      ? `${baseName(objectKeys[0])}.zip`
      : `${bucket}.zip`;

const listFolderKeys = async (
   { client, bucket, signal }: S3Scope,
   prefix: string,
   add: (key: string, size: number | undefined) => void,
   examinePage: (objects?: number) => void
): Promise<void> => {
   let token: string | undefined;
   do {
      signal?.throwIfAborted();
      examinePage();
      const page = await listObjects(
         { client, bucket, signal },
         {
            Prefix: prefix,
            MaxKeys: S3_MAX_KEYS_PER_REQUEST,
            ContinuationToken: token,
         }
      );
      withReleased(page, () => {
         signal?.throwIfAborted();
         examinePage((page.Contents ?? []).length);
         for (const object of page.Contents ?? []) {
            // a gateway that ignores Prefix must not zip keys outside the selected folder.
            if (object.Key?.startsWith(prefix)) add(object.Key, object.Size);
         }
         const next = nextListToken(page, token);
         token = next === undefined ? undefined : copyRetainedString(next);
      });
   } while (token);
};

// a key's parent lies inside whatever grant let the key through, so listing per parent never
// leaves a folder-limited caller's scope; a selection from one folder view shares one parent.
const listedSizes = async (
   scope: SignalScope,
   files: readonly string[]
): Promise<Map<string, number>> => {
   const byParent = new Map<string, string[]>();
   for (const key of files) {
      const parent = parentOf(key);
      const group = byParent.get(parent);
      if (group) group.push(key);
      else byParent.set(parent, [key]);
   }
   const sizes = new Map<string, number>();
   await inGroups(
      scope,
      [...byParent.values()].filter(
         (group) => group.length > EXISTS_LIST_THRESHOLD
      ),
      async (groupScope, group) => {
         const listed = await existingKeys(groupScope, group);
         for (const key of listed.existing) {
            const size = listed.sizes[key];
            if (size !== undefined) sizes.set(key, size);
         }
      }
   );
   return sizes;
};

const SEPARATOR = /[\\/]+/;

const normalizeEntryName = (name: string): string | null => {
   const segments: string[] = [];
   const printable = Array.from(name, (character) => {
      const code = character.codePointAt(0)!;
      return code < 32 || code === 127 ? "_" : character;
   }).join("");
   for (const rawSegment of printable.split(SEPARATOR)) {
      // archiver strips leading drive prefixes too; strip first so collision suffixes stay stable.
      const segment =
         segments.length === 0
            ? rawSegment.replace(/^(?:\w+:)+/, "")
            : rawSegment;
      if (segment === "" || segment === ".") continue;
      if (segment !== "..") segments.push(segment);
      else if (segments.pop() === undefined) return null;
   }
   return segments.join("/") || null;
};

const lastSegment = (key: string): string | null =>
   normalizeEntryName(baseName(key).split(SEPARATOR).at(-1) ?? "");

const FLATTENED_ENTRY_NAME = "file";

// macOS and Windows extract case-insensitively, so names differing only by case would overwrite each other.
const foldCase = (name: string): string => name.toLowerCase();

// used, nextSuffix and directories are keyed by folded names.
const distinctName = (
   name: string,
   used: Set<string>,
   nextSuffix: Map<string, number>,
   directories: ReadonlySet<string>
): string => {
   const folded = foldCase(name);
   let candidate = name;
   let suffix = nextSuffix.get(folded) ?? 2;
   while (used.has(foldCase(candidate)) || directories.has(foldCase(candidate)))
      candidate = `${name}.${suffix++}`;
   nextSuffix.set(folded, suffix);
   used.add(foldCase(candidate));
   return candidate;
};

const entryName = (key: string, root: string): string =>
   normalizeEntryName(key.slice(root.length)) ??
   lastSegment(key) ??
   FLATTENED_ENTRY_NAME;

const namedFiles = (objectKeys: readonly string[]): string[] =>
   objectKeys.filter((key) => !isFolderKey(key));

type CollectedEntries = {
   entries: ArchiveEntry[];
   bytes: number;
   fileSizes: ReadonlyMap<string, number>;
};

const collectWithin = (
   scope: SignalScope,
   objectKeys: readonly string[],
   { maxObjects, maxBytes }: ArchiveLimits,
   knownSizes?: ReadonlyMap<string, number>,
   manifest?: readonly ManifestEntry[]
): Promise<CollectedEntries> =>
   retainedRead(budgetServerOf(scope.client), async (reservation) => {
      let pages = 0;
      let examined = 0;
      const bounds = listingBounds(maxObjects, objectKeys.length);
      const examinePage = (objects?: number): void => {
         if (objects === undefined) pages++;
         else examined += objects;
         if (pages > bounds.pages || examined > bounds.examined)
            throw new StorageError(
               "tooLarge",
               "This folder needs too much work to zip. Select smaller folders or individual files."
            );
      };
      const root = archiveRoot(objectKeys);
      // selections are listed in parallel, so each lands in its own group and a key repeated by
      // overlapping selections shares one entry, kept where the first selection holding it puts it.
      const byKey = new Map<string, ArchiveEntry>();
      let bytes = 0;

      const add =
         (group: ArchiveEntry[]) =>
         (listedKey: string, listedSize: number | undefined): void => {
            scope.signal.throwIfAborted();
            if (isFolderKey(listedKey) && listedSize !== 0)
               throw new StorageError(
                  "conflict",
                  "This selection includes an object whose key ends in / and may contain data. ZIP downloads cannot represent it safely. Copy or move it to a key without a trailing slash before downloading."
               );
            const size = assertObjectSize(listedSize);
            if (isFolderKey(listedKey)) return;
            const known = byKey.get(listedKey);
            if (known) {
               group.push(known);
               return;
            }
            const key = copyRetainedString(listedKey);
            bytes += size;
            if (byKey.size >= maxObjects) {
               throw new StorageError(
                  "tooLarge",
                  `A zip can hold ${maxObjects} files; this selection has more. Pick fewer files.`
               );
            }
            if (bytes > maxBytes) {
               throw new StorageError(
                  "tooLarge",
                  `A zip is limited to ${gib(maxBytes)}; this selection is larger. Pick fewer files.`
               );
            }
            const name = entryName(key, root);
            reservation.retain(
               (key.length + name.length * 2) * 2 + ENTRY_MEMORY_OVERHEAD
            );
            const entry = { key, name, size };
            byKey.set(key, entry);
            group.push(entry);
         };

      const sizes = new Map<string, number>();
      let groups: ArchiveEntry[][];
      if (manifest) {
         const group: ArchiveEntry[] = [];
         for (const [key, size] of manifest) add(group)(key, size);
         groups = [group];
      } else {
         const files = namedFiles(objectKeys);
         for (const key of files) {
            const known = knownSizes?.get(key);
            if (known !== undefined) sizes.set(key, known);
         }
         const unsized = files.filter((key) => !sizes.has(key));
         for (const [key, size] of await listedSizes(scope, unsized))
            sizes.set(key, size);
         // a key the listing did not return is headed, so a missing file still answers 404.
         for (const [key, size] of await mapLimit(
            files.filter((key) => !sizes.has(key)),
            HEAD_CONCURRENCY,
            async (key) => {
               scope.signal.throwIfAborted();
               const head = await headObject(scope, key);
               return [key, head.ContentLength ?? 0] as const;
            }
         )) {
            sizes.set(key, size);
         }

         groups = await inGroups(scope, objectKeys, async (groupScope, key) => {
            const group: ArchiveEntry[] = [];
            if (isFolderKey(key))
               await listFolderKeys(groupScope, key, add(group), examinePage);
            else add(group)(key, sizes.get(key) ?? 0);
            return group;
         });
      }
      const entries = [...new Set(groups.flat())];
      if (entries.length === 0) {
         throw new StorageError(
            "notFound",
            "Nothing to zip: the selection is empty."
         );
      }
      // deepest directory first: a known ancestor means every parent above it is known too,
      // so entries sharing a long path cost one lookup each instead of one per segment.
      const directories = new Set<string>();
      for (const { name } of entries) {
         for (
            let slash = name.lastIndexOf("/");
            slash > 0;
            slash = name.lastIndexOf("/", slash - 1)
         ) {
            const directory = foldCase(name.slice(0, slash));
            if (directories.has(directory)) break;
            reservation.retain(directory.length * 2 + 128);
            directories.add(copyRetainedString(directory));
         }
      }
      const rewritten = entries.filter(
         ({ key, name }) => name !== key.slice(root.length)
      );
      const names = new Set<string>();
      const nextSuffix = new Map<string, number>();
      for (const entry of entries) {
         const name = distinctName(entry.name, names, nextSuffix, directories);
         reservation.retain(Math.max(0, name.length - entry.name.length) * 4);
         entry.name = name;
      }
      if (rewritten[0] !== undefined) {
         logger.warn("Zip entry names rewritten to stay inside the archive", {
            count: rewritten.length,
            firstKey: keyHash(rewritten[0].key),
         });
      }
      return { entries, bytes, fileSizes: sizes };
   });

type CollectionTenant = { userId: string; serverId: string };
type CollectionScope = S3Scope & { tenant?: CollectionTenant };

const collecting = keyedSlots();
const collectionBusy = () =>
   refusal("Zip preparation is busy. Try again shortly.");

// a manifest from the ticket replays what the selection listed, so only fresh listings count as collections.
const collectArchiveEntries = async (
   { tenant, ...scope }: CollectionScope,
   objectKeys: readonly string[],
   limits: ArchiveLimits,
   knownSizes?: ReadonlyMap<string, number>,
   manifest?: readonly ManifestEntry[]
): Promise<CollectedEntries> => {
   const release = collecting.acquire(
      manifest !== undefined
         ? []
         : [
              ["all", MAX_CONCURRENT_COLLECTIONS, collectionBusy],
              tenant && [
                 `user:${tenant.userId}`,
                 MAX_TENANT_COLLECTIONS,
                 collectionBusy,
              ],
              tenant && [
                 `server:${tenant.serverId}`,
                 MAX_TENANT_COLLECTIONS,
                 collectionBusy,
              ],
           ]
   );
   try {
      return await withDeadline(scope.signal, S3_ROUTE_TIMEOUT_MS, (signal) =>
         collectWithin(
            { ...scope, signal },
            objectKeys,
            limits,
            knownSizes,
            manifest
         )
      );
   } finally {
      release();
   }
};

export {
   MAX_CONCURRENT_COLLECTIONS,
   archiveFilename,
   collectArchiveEntries,
   listingBounds,
   namedFiles,
};
export type { ArchiveEntry, ArchiveLimits, ManifestEntry };
