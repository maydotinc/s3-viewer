import { siteOrigin } from "@/lib/env";
import { bucketGrantSelect, toBucketEntry } from "@/lib/services/members";
import type { $Enums, Prisma } from "@prisma/client";
import { highestRole } from "@s3-viewer/permissions";
import {
   DAY_MS,
   INVITE_TTL_DAYS,
   Role,
   SITE_PATHS,
   type ServerInvite,
} from "@s3-viewer/types";

const inviteSelect = {
   id: true,
   email: true,
   role: true,
   expiresAt: true,
   server: { select: { name: true } },
   invitedBy: { select: { name: true, email: true } },
   bucketAccess: {
      select: bucketGrantSelect,
      orderBy: { bucketName: "asc" },
   },
} satisfies Prisma.PendingInvitationSelect;

const addressedTo = (email: string) =>
   ({ equals: email.toLowerCase(), mode: "insensitive" }) as const;

type InviteRow = Prisma.PendingInvitationGetPayload<{
   select: typeof inviteSelect;
}>;

const toServerInvite = (row: InviteRow): ServerInvite => ({
   id: row.id,
   role: Role[row.role],
   expiresAt: row.expiresAt.toISOString(),
   email: row.email,
   server: { name: row.server.name },
   invitedBy: { name: row.invitedBy.name, email: row.invitedBy.email },
   bucketAccess: row.bucketAccess.map(toBucketEntry),
});

const inviteExpiry = (): Date =>
   new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS);

const invitesUrl = `${siteOrigin}${SITE_PATHS.invites}`;

const grantServerRole = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   invited: Role
): Promise<Role> => {
   const where = { userId_serverId: { userId, serverId } };
   const existing = await tx.serverAccess.findUnique({
      where,
      select: { role: true },
   });
   const role =
      highestRole(existing ? Role[existing.role] : null, invited) ?? invited;
   await tx.serverAccess.upsert({
      where,
      update: { role },
      create: { userId, serverId, role },
   });
   return role;
};

type BucketGrantRow = { bucketName: string; role: $Enums.Role };

const grantBucketRoles = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   grants: readonly BucketGrantRow[]
): Promise<void> => {
   const existing = await tx.bucketAccess.findMany({
      where: { userId, serverId },
      select: bucketGrantSelect,
   });
   const current = new Map(existing.map((b) => [b.bucketName, Role[b.role]]));
   for (const { bucketName, role: invited } of grants) {
      const role =
         highestRole(current.get(bucketName), Role[invited]) ?? Role[invited];
      await tx.bucketAccess.upsert({
         where: {
            userId_serverId_bucketName: { userId, serverId, bucketName },
         },
         update: { role },
         create: { userId, serverId, bucketName, role },
      });
   }
};

export {
   addressedTo,
   grantBucketRoles,
   grantServerRole,
   inviteExpiry,
   inviteSelect,
   invitesUrl,
   toServerInvite,
};
