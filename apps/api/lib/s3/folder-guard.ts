import type { S3Client } from "@aws-sdk/client-s3";
import {
   ErrorCode,
   hasDotSegment,
   isInFolderScope,
   isPrefixInFolderScope,
   prefixHasDotSegment,
   type FolderScope,
} from "@s3-viewer/shared";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "@/lib/logger";
import { StorageError } from "./errors";

type Reach = { folders: FolderScope; owner: boolean };
type FolderGrant = Reach & { serverId: string; bucket: string };
type GuardedInput = {
   Bucket?: unknown;
   Key?: unknown;
   Prefix?: unknown;
   CopySource?: unknown;
   Delete?: { Objects?: { Key?: unknown }[] };
};

const requestGrants = new AsyncLocalStorage<Map<string, Reach>>();

const grantKey = (serverId: string, bucket: string): string =>
   `${serverId}/${bucket}`;

// the ListMultipartUploads command is excluded: some endpoints ignore its Prefix, so it bounds nothing.
const LISTING_COMMANDS: ReadonlySet<string> = new Set([
   "ListObjectsV2Command",
   "ListObjectsCommand",
   "ListObjectVersionsCommand",
]);

const outsideFolders = (): StorageError =>
   new StorageError(
      "forbidden",
      "That path is outside the folders you have access to.",
      ErrorCode.FOLDER_ACCESS
   );

const parseCopySource = (
   value: string
): { bucket: string; key: string } | null => {
   const path = value.startsWith("/") ? value.slice(1) : value;
   const slash = path.indexOf("/");
   if (slash <= 0) return null;
   const [key] = path.slice(slash + 1).split("?");
   try {
      return {
         bucket: decodeURIComponent(path.slice(0, slash)),
         key: decodeURIComponent(key ?? ""),
      };
   } catch {
      return null;
   }
};

const refuseFolderAccess = (
   serverId: string,
   command: string | undefined
): never => {
   logger.error("Folder guard stopped a storage request", {
      serverId,
      command,
   });
   throw outsideFolders();
};

const keyAllowed = ({ folders, owner }: Reach, key: string): boolean =>
   owner || (!hasDotSegment(key) && isInFolderScope(folders, key));

const prefixAllowed = ({ folders, owner }: Reach, prefix: string): boolean =>
   owner ||
   (!prefixHasDotSegment(prefix) && isPrefixInFolderScope(folders, prefix));

const assertWithinFolders = (
   serverId: string,
   command: string | undefined,
   input: GuardedInput
): void => {
   const grants = requestGrants.getStore();
   if (!grants) return;
   const { Bucket, Key, Prefix, CopySource } = input;
   const reach =
      typeof Bucket === "string"
         ? grants.get(grantKey(serverId, Bucket))
         : undefined;
   if (reach) {
      const keys = [Key, ...(input.Delete?.Objects ?? []).map((o) => o.Key)];
      for (const key of keys) {
         if (typeof key === "string" && !keyAllowed(reach, key))
            refuseFolderAccess(serverId, command);
      }
      if (
         command !== undefined &&
         LISTING_COMMANDS.has(command) &&
         !prefixAllowed(reach, typeof Prefix === "string" ? Prefix : "")
      )
         refuseFolderAccess(serverId, command);
   }
   if (typeof CopySource !== "string") return;
   const source = parseCopySource(CopySource);
   if (!source) {
      const guarded = [...grants].some(
         ([key, { owner }]) => !owner && key.startsWith(`${serverId}/`)
      );
      if (guarded) refuseFolderAccess(serverId, command);
      return;
   }
   const sourceReach = grants.get(grantKey(serverId, source.bucket));
   if (sourceReach && !keyAllowed(sourceReach, source.key))
      refuseFolderAccess(serverId, command);
};

const withFolderGuard = (client: S3Client, serverId: string): S3Client => {
   client.middlewareStack.add(
      (next, context) => (args) => {
         assertWithinFolders(
            serverId,
            context.commandName,
            args.input as GuardedInput
         );
         return next(args);
      },
      { step: "initialize", name: "folderGuard" }
   );
   return client;
};

const guardFolders = <T>(grants: readonly FolderGrant[], run: () => T): T =>
   requestGrants.run(
      new Map(
         grants.map(({ serverId, bucket, folders, owner }) => [
            grantKey(serverId, bucket),
            { folders, owner },
         ])
      ),
      run
   );

export { guardFolders, outsideFolders, parseCopySource, withFolderGuard };
export type { FolderGrant };
