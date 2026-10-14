import { ROLE_LABELS } from "@s3-viewer/permissions";
import {
   Role,
   hasDotSegment,
   isInFolderScope,
   joinList,
   prefixHasDotSegment,
   type BucketAccessEntry,
   type FolderScope,
   type S3Bucket,
} from "@s3-viewer/types";
import { formatCount, pluralize, visibleText } from "./format";

type Reach = { folders: FolderScope; owner: boolean };

type KnownReach = Reach | undefined;

type FolderAccess =
   | "pending"
   | "whole"
   | "inside"
   | "leading"
   | "outside"
   | "dotted";

const DOT_SEGMENTS =
   "Paths with . or .. segments can only be opened by the server owner.";

const reachOf = (bucket: S3Bucket | null | undefined): KnownReach => {
   if (!bucket) return undefined;
   const owner = bucket.userRole === Role.OWNER;
   return { folders: owner ? null : (bucket.folders ?? null), owner };
};

const limitedFolders = (reach: KnownReach): readonly string[] | null =>
   reach?.folders ?? null;

const folderAccessAt = (reach: KnownReach, prefix: string): FolderAccess => {
   if (reach === undefined) return "pending";
   if (!reach.owner && hasDotSegment(prefix)) return "dotted";
   const { folders } = reach;
   if (folders === null) return "whole";
   if (isInFolderScope(folders, prefix)) return "inside";
   return folders.some((folder) => folder.startsWith(prefix))
      ? "leading"
      : "outside";
};

const canListPrefix = (reach: KnownReach, prefix: string): boolean =>
   reach?.owner === true || !prefixHasDotSegment(prefix);

const canWriteAt = (reach: KnownReach, key: string): boolean => {
   const access = folderAccessAt(reach, key);
   return access === "whole" || access === "inside";
};

const canActOnFolder = (
   serverRole: Role | null | undefined,
   bucket: S3Bucket | null | undefined,
   prefix: string
): boolean => serverRole === Role.OWNER || canWriteAt(reachOf(bucket), prefix);

const foldersUnder = (scope: readonly string[], prefix: string): string[] =>
   scope.filter((folder) => folder.startsWith(prefix));

const folderList = (folders: readonly string[]): string =>
   joinList(folders.map(visibleText));

// unknown reach passes: the API still refuses, and blocking while buckets load is worse.
const writeScopeError = (reach: KnownReach, key: string): string | null => {
   const access = folderAccessAt(reach, key);
   if (access === "dotted") return DOT_SEGMENTS;
   if (access === "leading" || access === "outside")
      return `You can only write inside ${folderList(limitedFolders(reach) ?? [])} in this bucket.`;
   return null;
};

const writeBlockReason = (reach: KnownReach, prefix: string): string | null => {
   const access = folderAccessAt(reach, prefix);
   if (access === "dotted") return DOT_SEGMENTS;
   if (access !== "leading" && access !== "outside") return null;
   const scope = limitedFolders(reach) ?? [];
   const reachable = foldersUnder(scope, prefix);
   return `You can only add files and folders inside ${folderList(reachable.length > 0 ? reachable : scope)}.`;
};

const rowBlockReason = (reach: KnownReach, key: string): string | null => {
   const access = folderAccessAt(reach, key);
   if (access === "dotted") return DOT_SEGMENTS;
   if (access !== "leading" && access !== "outside") return null;
   const under = foldersUnder(limitedFolders(reach) ?? [], key);
   if (under.length === 0) return "This isn't shared with you.";
   return `No actions here. Only ${folderList(under)} ${under.length === 1 ? "is" : "are"} shared with you.`;
};

const renameBlockReason = (reach: KnownReach, key: string): string | null =>
   limitedFolders(reach)?.includes(key)
      ? "You can't rename a folder that was shared with you."
      : null;

const accessNotice = (
   scope: readonly string[],
   prefix: string
): { title: string; detail: string; folders: string[] } => {
   const folders = foldersUnder(scope, prefix);
   const count = pluralize(folders.length, "folder");
   return {
      title: prefix
         ? `You have access to ${count} under ${visibleText(prefix)}`
         : `You have access to ${count} in this bucket`,
      detail: `Only the folders that lead to ${folders.length === 1 ? "it" : "them"} are shown here.`,
      folders,
   };
};

const uploadsScope = (reach: KnownReach, prefix: string): string => {
   const access = folderAccessAt(reach, prefix);
   if (access === "leading" || access === "outside")
      return prefix
         ? `in your folders under ${visibleText(prefix)}`
         : "in your folders";
   return prefix ? `under ${visibleText(prefix)}` : "in this bucket";
};

const folderLimitLabel = (folders: readonly string[]): string =>
   folders.length === 1
      ? `${visibleText(folders[0]!)} only`
      : `${formatCount(folders.length)} folders`;

const grantLabel = ({ role, folders }: BucketAccessEntry): string =>
   folders === null
      ? ROLE_LABELS[role]
      : `${ROLE_LABELS[role]} · ${folderLimitLabel(folders)}`;

type LimitedGrant = BucketAccessEntry & { folders: string[] };

const limitedGrants = (entries: readonly BucketAccessEntry[]): LimitedGrant[] =>
   entries.filter((entry): entry is LimitedGrant => entry.folders !== null);

const limitedGrantsNote = (
   entries: readonly BucketAccessEntry[]
): string | null => {
   const limited = limitedGrants(entries);
   const [only] = limited;
   if (!only) return null;
   return limited.length === 1
      ? `${only.bucketName}: ${folderLimitLabel(only.folders)}`
      : `Folders only on ${formatCount(limited.length)} buckets`;
};

export {
   DOT_SEGMENTS,
   accessNotice,
   canActOnFolder,
   canListPrefix,
   canWriteAt,
   folderAccessAt,
   folderList,
   grantLabel,
   limitedGrants,
   limitedGrantsNote,
   reachOf,
   renameBlockReason,
   rowBlockReason,
   uploadsScope,
   writeBlockReason,
   writeScopeError,
};
export type { KnownReach, Reach };
