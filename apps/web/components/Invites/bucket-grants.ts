import { visibleText } from "@/lib/utils/format";
import { folderList } from "@/lib/utils/folder-access";
import { ROLE_LABELS, canGrantBucketAccess } from "@s3-viewer/permissions";
import {
   MAX_BUCKET_NAMES,
   MAX_GRANT_FOLDERS,
   Role,
   canLimitToFolders,
   normalizeFolders,
   sameFolderScope,
   type BucketAccessEntry,
   type GrantableRole,
   type S3Bucket,
} from "@s3-viewer/shared";
import { addGrantFolder, normalizeFolderInput } from "./grant-folders";

type GrantPayload = {
   bucketName: string;
   role: GrantableRole;
   folders: string[] | null;
};

type GrantRow = BucketAccessEntry & {
   draft?: string;
   parked?: string[];
   restoreOnRole?: boolean;
};

const ADMIN_FOLDERS =
   "Admins can't be limited to folders. Choose Whole bucket or a different server role.";

const heldGrant = (bucket: S3Bucket) => ({
   role: bucket.userRole,
   folders: bucket.folders,
});

// changing or unchecking a grant removes it first, which takes the same authority as granting it
const isLocked = (
   myRole: Role,
   bucket: S3Bucket,
   original: BucketAccessEntry | undefined
): boolean =>
   original !== undefined &&
   !canGrantBucketAccess(myRole, heldGrant(bucket), original);

const newGrant = (bucket: S3Bucket, role: Role): GrantRow => ({
   bucketName: bucket.name,
   role,
   folders: null,
});

const checkedGrant = (
   original: BucketAccessEntry | undefined,
   bucket: S3Bucket,
   role: Role
): GrantRow =>
   original
      ? { ...original, folders: original.folders && [...original.folders] }
      : newGrant(bucket, role);

const withRole = (row: GrantRow, role: Role): GrantRow => {
   if (!canLimitToFolders(role))
      return row.folders === null
         ? { ...row, role }
         : {
              ...row,
              role,
              folders: null,
              parked: row.folders,
              restoreOnRole: true,
           };
   if (row.restoreOnRole && row.folders === null && row.parked)
      return {
         ...row,
         role,
         folders: row.parked,
         parked: undefined,
         restoreOnRole: undefined,
      };
   return { ...row, role };
};

const withWholeBucket = (row: GrantRow): GrantRow => ({
   ...row,
   folders: null,
   parked: row.folders ?? row.parked,
   restoreOnRole: undefined,
});

const withSpecificFolders = (
   row: GrantRow,
   original?: BucketAccessEntry
): GrantRow => ({
   ...row,
   folders: [...(row.folders ?? row.parked ?? original?.folders ?? [])],
   parked: undefined,
   restoreOnRole: undefined,
});

const unchanged = (
   entry: BucketAccessEntry,
   original: BucketAccessEntry | undefined
): boolean =>
   original !== undefined &&
   entry.role === original.role &&
   sameFolderScope(entry.folders, original.folders);

type GrantContext = {
   myRole: Role;
   bucket: S3Bucket;
   original?: BucketAccessEntry;
   serverRole?: Role;
};

const serverRoleError = (
   entry: BucketAccessEntry,
   serverRole: Role | undefined
): string | null =>
   entry.folders !== null &&
   serverRole !== undefined &&
   !canLimitToFolders(serverRole)
      ? ADMIN_FOLDERS
      : null;

const grantError = (
   entry: BucketAccessEntry,
   { myRole, bucket, original, serverRole }: GrantContext
): string | null => {
   const blocked = serverRoleError(entry, serverRole);
   if (blocked) return blocked;
   if (entry.folders !== null && entry.folders.length === 0)
      return "Add at least one folder, or choose Whole bucket.";
   if (unchanged(entry, original)) return null;
   if (entry.folders !== null && entry.folders.length > MAX_GRANT_FOLDERS)
      return `Choose at most ${MAX_GRANT_FOLDERS} folders.`;
   if (canGrantBucketAccess(myRole, heldGrant(bucket), entry)) return null;
   return `You can't give ${ROLE_LABELS[entry.role]} access to this bucket.`;
};

const pendingDraft = (row: GrantRow): string | null =>
   row.folders !== null && row.draft?.trim() ? row.draft : null;

type DraftCommit = { row: GrantRow; problem: string | null };

const commitDraft = (row: GrantRow): DraftCommit => {
   const draft = pendingDraft(row);
   if (draft === null || row.folders === null) return { row, problem: null };
   if (row.folders.includes(normalizeFolderInput(draft)))
      return { row: { ...row, draft: "" }, problem: null };
   const result = addGrantFolder(row.folders, draft);
   if (!result.ok)
      return {
         row,
         problem: `${result.error} Fix or clear the folder you typed.`,
      };
   if (result.replaced.length > 0)
      return {
         row,
         problem: `Press Add to confirm ${visibleText(result.folder)}. It replaces ${folderList(result.replaced)}.`,
      };
   return {
      row: { ...row, folders: result.folders, draft: "" },
      problem: null,
   };
};

type AccessCheck = {
   buckets: readonly S3Bucket[];
   myRole: Role;
   originals?: readonly BucketAccessEntry[];
   serverRole?: Role;
};

const forEachKnownRow = (
   rows: readonly GrantRow[],
   { buckets, originals = [] }: AccessCheck,
   visit: (
      row: GrantRow,
      bucket: S3Bucket,
      original?: BucketAccessEntry
   ) => void
) => {
   const byName = new Map(buckets.map((bucket) => [bucket.name, bucket]));
   const before = new Map(
      originals.map((original) => [original.bucketName, original])
   );
   for (const row of rows) {
      const bucket = byName.get(row.bucketName);
      if (!bucket) continue;
      visit(row, bucket, before.get(row.bucketName));
   }
};

const commitDrafts = (
   rows: readonly GrantRow[],
   check: AccessCheck
): GrantRow[] => {
   const committed = new Map<string, GrantRow>();
   forEachKnownRow(rows, check, (row) => {
      committed.set(row.bucketName, commitDraft(row).row);
   });
   return rows.map((row) => committed.get(row.bucketName) ?? row);
};

const accessErrors = (
   rows: readonly GrantRow[],
   check: AccessCheck & { drafts?: boolean }
): Map<string, string> => {
   const errors = new Map<string, string>();
   forEachKnownRow(rows, check, (row, bucket, original) => {
      const error =
         serverRoleError(row, check.serverRole) ??
         (check.drafts ? commitDraft(row).problem : null) ??
         grantError(row, {
            myRole: check.myRole,
            bucket,
            original,
            serverRole: check.serverRole,
         });
      if (error) errors.set(row.bucketName, error);
   });
   return errors;
};

const hasDrafts = (rows: readonly GrantRow[]): boolean =>
   rows.some((row) => pendingDraft(row) !== null);

const accessSummaryError = ([bucketName, error]: readonly [
   string,
   string,
]): string =>
   error === ADMIN_FOLDERS
      ? `Admins can't be limited to folders. Choose Whole bucket on ${bucketName}, or a different server role.`
      : `Check the access on ${bucketName}.`;

const accessKey = (entries: readonly GrantRow[]): string =>
   entries
      .map(({ bucketName, role, folders }) =>
         JSON.stringify([
            bucketName,
            role,
            folders === null ? null : normalizeFolders(folders),
         ])
      )
      .sort()
      .join(",");

const grantPayload = (entries: readonly GrantRow[]): GrantPayload[] =>
   entries.flatMap(({ bucketName, role, folders }) =>
      role === Role.OWNER
         ? []
         : [{ bucketName, role, folders: folders && [...folders] }]
   );

const TOO_MANY_BUCKETS = `Choose at most ${MAX_BUCKET_NAMES} buckets`;

const tooManyBuckets = (entries: readonly GrantRow[]): boolean =>
   entries.filter(({ role }) => role !== Role.OWNER).length > MAX_BUCKET_NAMES;

export {
   TOO_MANY_BUCKETS,
   accessErrors,
   accessKey,
   accessSummaryError,
   commitDraft,
   commitDrafts,
   grantError,
   grantPayload,
   hasDrafts,
   checkedGrant,
   tooManyBuckets,
   isLocked,
   newGrant,
   withRole,
   withSpecificFolders,
   withWholeBucket,
};
export type { GrantRow };
