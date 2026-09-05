import { siteOrigin } from "@/lib/env";
import { bucketGrantSelect, toBucketEntry } from "@/lib/services/members";
import type { $Enums, Prisma } from "@prisma/client";
import { canManageRole, highestRole } from "@s3-viewer/permissions";
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
   serverId: true,
   invitedById: true,
   server: { select: { id: true, name: true } },
   invitedBy: { select: { name: true, email: true } },
   bucketAccess: {
      select: bucketGrantSelect,
      orderBy: { bucketName: "asc" },
   },
} satisfies Prisma.PendingInvitationSelect;

const addressedTo = (email: string) => email.toLowerCase();

const liveInvite = () => ({ expiresAt: { gt: new Date() } });

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

type InviteAuthority = {
   invitedById: string;
   serverId: string;
   role: $Enums.Role;
   bucketAccess: readonly BucketGrantRow[];
};

// an invite is only as good as the authority of whoever sent it: a sender who
// was removed, demoted, or has lost the right to hand out one of its roles
// must not still be granting access days later, and the invitee must not be
// shown an invite that can no longer be accepted
const canStillGrant = (
   senderRole: Role | null,
   invite: Pick<InviteAuthority, "role" | "bucketAccess">
): boolean =>
   canManageRole(senderRole, Role[invite.role]) &&
   invite.bucketAccess.every((grant) =>
      canManageRole(senderRole, Role[grant.role])
   );

const senderKey = ({ invitedById, serverId }: InviteAuthority): string =>
   `${invitedById}:${serverId}`;

const stillGrantable = async <T extends InviteAuthority>(
   db: Prisma.TransactionClient,
   invites: readonly T[]
): Promise<T[]> => {
   if (invites.length === 0) return [];
   const senders = await db.serverAccess.findMany({
      where: {
         OR: invites.map(({ invitedById, serverId }) => ({
            userId: invitedById,
            serverId,
         })),
      },
      select: { userId: true, serverId: true, role: true },
   });
   const roles = new Map(
      senders.map((s) => [`${s.userId}:${s.serverId}`, Role[s.role]])
   );
   return invites.filter((invite) =>
      canStillGrant(roles.get(senderKey(invite)) ?? null, invite)
   );
};

const senderCanStillGrant = async (
   tx: Prisma.TransactionClient,
   invite: InviteAuthority
): Promise<boolean> => (await stillGrantable(tx, [invite])).length === 1;

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
   liveInvite,
   senderCanStillGrant,
   stillGrantable,
   toServerInvite,
};
