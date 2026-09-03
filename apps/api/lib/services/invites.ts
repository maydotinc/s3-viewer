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
   server: { select: { id: true, name: true } },
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
   server: { id: row.server.id, name: row.server.name },
   invitedBy: { name: row.invitedBy.name, email: row.invitedBy.email },
   bucketAccess: row.bucketAccess.map(toBucketEntry),
});

const inviteExpiry = (): Date =>
   new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS);

const invitesUrl = `${siteOrigin}${SITE_PATHS.settingsInvites}`;

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
   const creates: BucketGrantRow[] = [];
   const updates = new Map<Role, string[]>();
   for (const { bucketName, role: invited } of grants) {
      const held = current.get(bucketName);
      const role = highestRole(held, Role[invited]) ?? Role[invited];
      if (held === undefined) creates.push({ bucketName, role });
      else if (held !== role)
         updates.set(role, [...(updates.get(role) ?? []), bucketName]);
   }
   for (const [role, bucketNames] of updates) {
      await tx.bucketAccess.updateMany({
         where: { userId, serverId, bucketName: { in: bucketNames } },
         data: { role },
      });
   }
   if (creates.length > 0) {
      await tx.bucketAccess.createMany({
         data: creates.map((grant) => ({ userId, serverId, ...grant })),
         skipDuplicates: true,
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
