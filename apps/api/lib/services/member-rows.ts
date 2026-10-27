import { keysetAfter, type Position } from "@/lib/cursor";
import {
   bucketGrantSelect,
   bucketGrantsLateral,
   findUnremovableGrant,
   toBucketEntry,
} from "./bucket-grants";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { canRemoveAccess } from "@s3-viewer/permissions";
import { Role, type ScopedGrant, type ServerUser } from "@s3-viewer/shared";

const memberSelect = (serverId: string) =>
   ({
      id: true,
      createdAt: true,
      role: true,
      user: {
         select: {
            id: true,
            name: true,
            email: true,
            bucketAccess: {
               where: { serverId },
               select: bucketGrantSelect,
               orderBy: { bucketName: "asc" },
            },
         },
      },
   }) satisfies Prisma.ServerAccessSelect;

type MemberRow = Prisma.ServerAccessGetPayload<{
   select: ReturnType<typeof memberSelect>;
}>;

type Actor = { id: string; role: Role };

type Viewer = Actor & { held: ReadonlyMap<string, ScopedGrant> };

// mirrors removeMembership's checks over every grant, hidden ones included, so the web never offers a refused removal.
const canRemoveMember = (viewer: Viewer, row: MemberRow): boolean =>
   viewer.id !== row.user.id &&
   canRemoveAccess(
      viewer.role,
      row.role,
      row.user.bucketAccess.map((grant) => grant.role)
   ) &&
   !findUnremovableGrant(viewer.role, viewer.held, row.user.bucketAccess);

const toServerUser = (row: MemberRow, viewer: Viewer): ServerUser => ({
   id: row.user.id,
   name: row.user.name,
   email: row.user.email,
   role: row.role,
   bucketAccess: row.user.bucketAccess.map(toBucketEntry),
   canRemove: canRemoveMember(viewer, row),
});

const memberPage = (
   serverId: string,
   position: Position | undefined,
   take: number
): Promise<MemberRow[]> =>
   prisma.$queryRaw<MemberRow[]>`
      WITH page AS (
         SELECT "id", "createdAt", "role", "userId", "serverId"
         FROM "server_access"
         WHERE "serverId" = ${serverId} ${
            position
               ? Prisma.sql`AND ${keysetAfter(position, "asc")}`
               : Prisma.empty
         }
         ORDER BY "createdAt" ASC, "id" ASC
         LIMIT ${take}
      )
      SELECT page."id", page."createdAt", page."role",
         jsonb_build_object(
            'id', u."id", 'name', u."name", 'email', u."email",
            'bucketAccess', COALESCE(grants.buckets, '[]'::jsonb)
         ) AS "user"
      FROM page
      JOIN "user" u ON u."id" = page."userId"
      ${bucketGrantsLateral(
         "bucket_access",
         Prisma.sql`b."userId" = page."userId" AND b."serverId" = page."serverId"`
      )}
      ORDER BY page."createdAt" ASC, page."id" ASC`;

export { memberPage, memberSelect, toServerUser };
export type { Actor, Viewer };
