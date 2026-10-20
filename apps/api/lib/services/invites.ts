import { randomBytes } from "node:crypto";
import { siteOrigin } from "@/lib/env";
import {
   bucketGrantSelect,
   bucketGrantsLateral,
   folderColumns,
   toBucketEntry,
   toScopedGrant,
   type BucketRow,
} from "./bucket-grants";
import { grantsByBucket, loadBucketGrants, memberRole } from "./members";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { keysetAfter, type Position } from "@/lib/cursor";
import { highestRole, mergeBucketGrants } from "@s3-viewer/permissions";
import {
   DAY_MS,
   INVITE_QUERY_PARAM,
   INVITE_TTL_DAYS,
   MAX_PENDING_INVITES,
   Role,
   SITE_PATHS,
   normalizeEmail,
   sameFolderScope,
   type BucketAccessEntry,
   type ServerInvite,
} from "@s3-viewer/types";

const inviteSelect = {
   id: true,
   createdAt: true,
   email: true,
   role: true,
   expiresAt: true,
   serverId: true,
   invitedById: true,
   server: { select: { id: true, name: true } },
   invitedBy: { select: { name: true, email: true } },
   bucketAccess: {
      select: bucketGrantSelect,
      orderBy: { bucketName: "asc" },
   },
} satisfies Prisma.PendingInvitationSelect;

type InviteRow = Prisma.PendingInvitationGetPayload<{
   select: typeof inviteSelect;
}>;

const livePage = (
   filter: Prisma.Sql,
   position: Position | undefined,
   take: number
): Promise<InviteRow[]> =>
   prisma.$queryRaw<InviteRow[]>`
      WITH page AS (
         SELECT "id", "createdAt", "email", "role", "expiresAt", "serverId", "invitedById"
         FROM "pending_invitation"
         WHERE ${filter} AND "expiresAt" > ${new Date().toISOString()}::timestamp ${
            position
               ? Prisma.sql`AND ${keysetAfter(position, "desc")}`
               : Prisma.empty
         }
         ORDER BY "createdAt" DESC, "id" DESC
         LIMIT ${take}
      )
      SELECT page.*,
         jsonb_build_object('id', s."id", 'name', s."name") AS "server",
         jsonb_build_object('name', u."name", 'email', u."email") AS "invitedBy",
         COALESCE(grants.buckets, '[]'::jsonb) AS "bucketAccess"
      FROM page
      JOIN "server" s ON s."id" = page."serverId"
      JOIN "user" u ON u."id" = page."invitedById"
      ${bucketGrantsLateral(
         "invitation_bucket_access",
         Prisma.sql`b."invitationId" = page."id"`
      )}
      ORDER BY page."createdAt" DESC, page."id" DESC`;

const receivedInvitePage = (
   email: string,
   position: Position | undefined,
   take: number
): Promise<InviteRow[]> =>
   livePage(Prisma.sql`"email" = ${normalizeEmail(email)}`, position, take);

const serverInvitePage = (serverId: string): Promise<InviteRow[]> =>
   livePage(
      Prisma.sql`"serverId" = ${serverId}`,
      undefined,
      MAX_PENDING_INVITES
   );

const toServerInvite = (row: InviteRow): ServerInvite => ({
   id: row.id,
   role: Role[row.role],
   expiresAt: row.expiresAt.toISOString(),
   email: row.email,
   server: { id: row.server.id, name: row.server.name },
   invitedBy: { name: row.invitedBy.name, email: row.invitedBy.email },
   bucketAccess: row.bucketAccess.map(toBucketEntry),
});

const inviteExpiry = (): Date =>
   new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS);

const inviteToken = (): string => randomBytes(32).toString("base64url");

const invitesUrl = (token: string): string =>
   `${siteOrigin}${SITE_PATHS.settingsInvites}?${INVITE_QUERY_PARAM}=${encodeURIComponent(token)}`;

const grantServerRole = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   invited: Role
): Promise<Role> => {
   const role =
      highestRole(await memberRole(tx, userId, serverId), invited) ?? invited;
   await tx.serverAccess.upsert({
      where: { userId_serverId: { userId, serverId } },
      update: { role },
      create: { userId, serverId, role },
   });
   return role;
};

const grantBucketRoles = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   grants: readonly BucketRow[]
): Promise<BucketAccessEntry[]> => {
   const current = grantsByBucket(await loadBucketGrants(userId, serverId, tx));
   const creates: Prisma.BucketAccessCreateManyInput[] = [];
   const granted: BucketAccessEntry[] = [];
   for (const invited of grants) {
      const { bucketName } = invited;
      const held = current.get(bucketName);
      const merged = mergeBucketGrants(held, toScopedGrant(invited));
      granted.push({
         bucketName,
         role: merged.role,
         folders: merged.folders === null ? null : [...merged.folders],
      });
      const data = { role: merged.role, ...folderColumns(merged.folders) };
      if (!held) {
         creates.push({ userId, serverId, bucketName, ...data });
      } else if (
         held.role !== merged.role ||
         !sameFolderScope(held.folders, merged.folders)
      ) {
         await tx.bucketAccess.update({
            where: {
               userId_serverId_bucketName: { userId, serverId, bucketName },
            },
            data,
         });
      }
   }
   if (creates.length > 0) {
      await tx.bucketAccess.createMany({ data: creates, skipDuplicates: true });
   }
   return granted;
};

export {
   grantBucketRoles,
   grantServerRole,
   inviteExpiry,
   inviteSelect,
   inviteToken,
   invitesUrl,
   receivedInvitePage,
   serverInvitePage,
   toServerInvite,
};
