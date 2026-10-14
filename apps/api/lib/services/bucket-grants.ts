import { Prisma, type $Enums } from "@prisma/client";
import { canGrantBucketAccess } from "@s3-viewer/permissions";
import {
   Role,
   type BucketAccessEntry,
   type FolderScope,
   type ScopedGrant,
} from "@s3-viewer/types";

type FolderColumns = { restrictedFolders: boolean; allowedFolders: string[] };
type BucketRow = { bucketName: string; role: $Enums.Role } & FolderColumns;

const bucketGrantSelect = {
   bucketName: true,
   role: true,
   restrictedFolders: true,
   allowedFolders: true,
} satisfies Prisma.BucketAccessSelect;

// only an explicit "not restricted" reads as the whole bucket.
const grantFoldersOf = ({
   restrictedFolders,
   allowedFolders,
}: {
   restrictedFolders?: boolean | null;
   allowedFolders?: string[] | null;
}): string[] | null =>
   restrictedFolders === false ? null : (allowedFolders ?? []);

const bucketGrantJson = (alias: string): Prisma.Sql => {
   const column = (name: string) => Prisma.raw(`${alias}."${name}"`);
   return Prisma.sql`jsonb_build_object(
               'bucketName', ${column("bucketName")}, 'role', ${column("role")},
               'restrictedFolders', ${column("restrictedFolders")},
               'allowedFolders', ${column("allowedFolders")}
            )`;
};

// folds each page row's grants into one jsonb array so a page costs a single round trip.
const bucketGrantsLateral = (table: string, owning: Prisma.Sql): Prisma.Sql =>
   Prisma.sql`
      LEFT JOIN LATERAL (
         SELECT jsonb_agg(
            ${bucketGrantJson("b")}
            ORDER BY b."bucketName"
         ) AS buckets
         FROM ${Prisma.raw(`"${table}"`)} b
         WHERE ${owning}
      ) grants ON TRUE`;

const folderColumns = (folders: FolderScope): FolderColumns => ({
   restrictedFolders: folders !== null,
   allowedFolders: folders === null ? [] : [...folders],
});

const toBucketEntry = (row: BucketRow): BucketAccessEntry => ({
   bucketName: row.bucketName,
   role: Role[row.role],
   folders: grantFoldersOf(row),
});

const toScopedGrant = (row: BucketRow): ScopedGrant => ({
   role: Role[row.role],
   folders: grantFoldersOf(row),
});

// removing a grant takes the same authority as handing it out, or an admin could strip access on buckets they don't hold.
const canRemoveGrant = (
   serverRole: Role | null,
   held: ReadonlyMap<string, ScopedGrant>,
   row: BucketRow
): boolean =>
   canGrantBucketAccess(
      serverRole,
      held.get(row.bucketName),
      toScopedGrant(row)
   );

// null reads as every bucket: only owners get that, since admins have no implicit bucket access.
type VisibleBuckets = ReadonlySet<string> | null;

const visibleGrants = <Grant extends { bucketName: string }>(
   visible: VisibleBuckets,
   grants: readonly Grant[]
): Grant[] =>
   visible === null
      ? [...grants]
      : grants.filter(({ bucketName }) => visible.has(bucketName));

const withVisibleGrants = <T extends { bucketAccess: BucketAccessEntry[] }>(
   visible: VisibleBuckets,
   holder: T
): T => ({
   ...holder,
   bucketAccess: visibleGrants(visible, holder.bucketAccess),
});

const findUnremovableGrant = <Row extends BucketRow>(
   serverRole: Role | null,
   held: ReadonlyMap<string, ScopedGrant>,
   rows: readonly Row[]
): Row | undefined =>
   rows.find((row) => !canRemoveGrant(serverRole, held, row));

export {
   bucketGrantJson,
   bucketGrantSelect,
   bucketGrantsLateral,
   canRemoveGrant,
   findUnremovableGrant,
   folderColumns,
   grantFoldersOf,
   toBucketEntry,
   toScopedGrant,
   visibleGrants,
   withVisibleGrants,
};
export type { BucketRow, VisibleBuckets };
