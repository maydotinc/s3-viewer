import {
   GIB,
   S3_MAX_KEYS_PER_REQUEST,
   baseName,
   isFolderKey,
   mapLimit,
} from "@s3-viewer/types";
import { HEAD_CONCURRENCY, S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { ApiHttpError, rateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { withDeadline } from "@/lib/utils/abort";
import { headObject } from "../head";
import { assertObjectSize, keyHash } from "../keys";
import { listObjects, nextListToken, type S3Scope } from "../listing";
import { copyRetainedString, retainedRead } from "../read-budget";
import { budgetServerOf } from "../request-budget";
import { releaseBufferedResponse } from "../response-collector";

type ArchiveEntry = { key: string; name: string; size: number };
type ArchiveLimits = { maxObjects: number; maxBytes: number };

const ENTRY_MEMORY_OVERHEAD = 512;
// listing and naming a selection is CPU work, and ticket creation does it before any slot is held.
const MAX_CONCURRENT_COLLECTIONS = 4;
// one account or server may not hold the whole collection cap.
const MAX_TENANT_COLLECTIONS = 2;
// folder markers and keys repeated by overlapping selections are listed but never become entries.
const EXAMINED_PER_ENTRY = 4;
// listings are one page of 1000 keys at best; stores that answer short pages get twice as many.
const PAGE_SLACK = 2;

type ManifestEntry = readonly [key: string, size: number];

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

const parentOf = (key: string): string => {
   const trimmed = isFolderKey(key) ? key.slice(0, -1) : key;
   return trimmed.slice(0, trimmed.lastIndexOf("/") + 1);
};

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
      try {
         signal?.throwIfAborted();
         examinePage((page.Contents ?? []).length);
         for (const object of page.Contents ?? []) {
            // a gateway that ignores Prefix must not zip keys outside the selected folder.
            if (object.Key?.startsWith(prefix)) add(object.Key, object.Size);
         }
         const next = nextListToken(page, token);
         token = next === undefined ? undefined : copyRetainedString(next);
      } finally {
         releaseBufferedResponse(page);
      }
   } while (token);
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

const distinctName = (
   name: string,
   used: Set<string>,
   nextSuffix: Map<string, number>,
   directories: ReadonlySet<string>
): string => {
   let candidate = name;
   let suffix = nextSuffix.get(name) ?? 2;
   while (used.has(candidate) || directories.has(candidate))
      candidate = `${name}.${suffix++}`;
   nextSuffix.set(name, suffix);
   used.add(candidate);
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
   scope: S3Scope & { signal: AbortSignal },
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
            throw new ApiHttpError(
               413,
               "This folder needs too much work to zip. Select smaller folders or individual files."
            );
      };
      const root = archiveRoot(objectKeys);
      const entries: ArchiveEntry[] = [];
      const seen = new Set<string>();
      let bytes = 0;
      let rewritten = 0;
      let firstRewritten: string | undefined;

      const add = (listedKey: string, listedSize: number | undefined): void => {
         scope.signal.throwIfAborted();
         if (isFolderKey(listedKey) && listedSize !== 0)
            throw new ApiHttpError(
               409,
               "This selection includes an object whose key ends in / and may contain data. ZIP downloads cannot represent it safely. Copy or move it to a key without a trailing slash before downloading."
            );
         const size = assertObjectSize(listedSize);
         if (isFolderKey(listedKey) || seen.has(listedKey)) return;
         const key = copyRetainedString(listedKey);
         seen.add(key);
         bytes += size;
         if (entries.length >= maxObjects) {
            throw new ApiHttpError(
               413,
               `A zip can hold ${maxObjects} files; this selection has more. Pick fewer files.`
            );
         }
         if (bytes > maxBytes) {
            throw new ApiHttpError(
               413,
               `A zip is limited to ${gib(maxBytes)}; this selection is larger. Pick fewer files.`
            );
         }
         const name = entryName(key, root);
         if (name !== key.slice(root.length)) {
            rewritten++;
            firstRewritten ??= key;
         }
         reservation.retain(
            (key.length + name.length * 2) * 2 + ENTRY_MEMORY_OVERHEAD
         );
         entries.push({ key, name, size });
      };

      const sizes = new Map<string, number>();
      if (manifest) {
         for (const [key, size] of manifest) add(key, size);
      } else {
         const files = namedFiles(objectKeys);
         for (const key of files) {
            const known = knownSizes?.get(key);
            if (known !== undefined) sizes.set(key, known);
         }
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

         for (const key of objectKeys) {
            if (isFolderKey(key))
               await listFolderKeys(scope, key, add, examinePage);
            else add(key, sizes.get(key) ?? 0);
         }
      }
      if (entries.length === 0) {
         throw new ApiHttpError(404, "Nothing to zip: the selection is empty.");
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
            const directory = name.slice(0, slash);
            if (directories.has(directory)) break;
            reservation.retain(directory.length * 2 + 128);
            directories.add(copyRetainedString(directory));
         }
      }
      const names = new Set<string>();
      const nextSuffix = new Map<string, number>();
      for (const entry of entries) {
         const name = distinctName(entry.name, names, nextSuffix, directories);
         reservation.retain(Math.max(0, name.length - entry.name.length) * 4);
         entry.name = name;
      }
      if (firstRewritten !== undefined) {
         logger.warn("Zip entry names rewritten to stay inside the archive", {
            count: rewritten,
            firstKey: keyHash(firstRewritten),
         });
      }
      return { entries, bytes, fileSizes: sizes };
   });

type CollectionTenant = { userId: string; serverId: string };
type CollectionScope = S3Scope & { tenant?: CollectionTenant };

const collecting = new Map<string, number>();
const collectingKeys = ({ userId, serverId }: CollectionTenant): string[] => [
   `user:${userId}`,
   `server:${serverId}`,
];
const countOf = (key: string): number => collecting.get(key) ?? 0;
const adjust = (keys: readonly string[], delta: number): void => {
   for (const key of keys) {
      const next = countOf(key) + delta;
      if (next > 0) collecting.set(key, next);
      else collecting.delete(key);
   }
};

// a manifest from the ticket replays what the selection listed, so only fresh listings count as collections.
const collectArchiveEntries = async (
   { tenant, ...scope }: CollectionScope,
   objectKeys: readonly string[],
   limits: ArchiveLimits,
   knownSizes?: ReadonlyMap<string, number>,
   manifest?: readonly ManifestEntry[]
): Promise<CollectedEntries> => {
   const listing = manifest === undefined;
   const keys = listing
      ? ["all", ...(tenant ? collectingKeys(tenant) : [])]
      : [];
   const busy =
      countOf("all") >= MAX_CONCURRENT_COLLECTIONS ||
      keys.slice(1).some((key) => countOf(key) >= MAX_TENANT_COLLECTIONS);
   if (listing && busy)
      throw rateLimited("Zip preparation is busy. Try again shortly.");
   adjust(keys, 1);
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
      adjust(keys, -1);
   }
};

export {
   MAX_CONCURRENT_COLLECTIONS,
   MAX_TENANT_COLLECTIONS,
   archiveFilename,
   collectArchiveEntries,
   listingBounds,
   namedFiles,
};
export type { ArchiveEntry, ArchiveLimits, ManifestEntry };
