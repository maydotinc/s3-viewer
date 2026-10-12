import type { Prisma, $Enums } from "@prisma/client";
import { canGrantBucketAccess, canManageRole } from "@s3-viewer/permissions";
import {
   bucketGrantSelect,
   toScopedGrant,
   type BucketRow,
} from "./bucket-grants";
import { isBucketAllowed } from "./servers";
import { Role, type AuditEntry } from "@s3-viewer/types";

type InviteAuthority = {
   invitedById: string;
   serverId: string;
   role: $Enums.Role;
   bucketAccess: readonly BucketRow[];
};

const senderKey = (userId: string, serverId: string) => `${userId}:${serverId}`;

const stillGrantable = async <T extends InviteAuthority>(
   db: Prisma.TransactionClient,
   invites: readonly T[]
): Promise<T[]> => {
   if (invites.length === 0) return [];
   const pairs = new Map(
      invites.map(({ invitedById: userId, serverId }) => [
         senderKey(userId, serverId),
         { userId, serverId },
      ])
   );
   const senders = await db.serverAccess.findMany({
      where: { OR: [...pairs.values()] },
      select: {
         userId: true,
         serverId: true,
         role: true,
         server: {
            select: { restrictedBuckets: true, allowedBuckets: true },
         },
      },
   });
   const actors = new Map(
      senders.map((s) => [senderKey(s.userId, s.serverId), s])
   );
   const requestedBuckets = new Map<string, Set<string>>();
   for (const invite of invites) {
      const key = senderKey(invite.invitedById, invite.serverId);
      const actor = actors.get(key);
      if (
         !actor ||
         actor.role === Role.OWNER ||
         !canManageRole(Role[actor.role], Role[invite.role])
      )
         continue;
      for (const { bucketName } of invite.bucketAccess) {
         if (!isBucketAllowed(actor.server, bucketName)) continue;
         let buckets = requestedBuckets.get(key);
         if (!buckets) requestedBuckets.set(key, (buckets = new Set()));
         buckets.add(bucketName);
      }
   }
   const grants = requestedBuckets.size
      ? await db.bucketAccess.findMany({
           where: {
              OR: [...requestedBuckets].map(([key, buckets]) => ({
                 ...pairs.get(key)!,
                 bucketName: { in: [...buckets] },
              })),
           },
           select: { userId: true, serverId: true, ...bucketGrantSelect },
        })
      : [];
   const held = new Map(
      grants.map((g) => [
         `${senderKey(g.userId, g.serverId)}:${g.bucketName}`,
         toScopedGrant(g),
      ])
   );
   return invites.filter((invite) => {
      const key = senderKey(invite.invitedById, invite.serverId);
      const actor = actors.get(key);
      if (!actor || !canManageRole(Role[actor.role], Role[invite.role]))
         return false;
      return invite.bucketAccess.every(
         (grant) =>
            isBucketAllowed(actor.server, grant.bucketName) &&
            canGrantBucketAccess(
               Role[actor.role],
               held.get(`${key}:${grant.bucketName}`),
               toScopedGrant(grant)
            )
      );
   });
};

const senderCanStillGrant = async (
   tx: Prisma.TransactionClient,
   invite: InviteAuthority
) => (await stillGrantable(tx, [invite])).length === 1;

const inviteRevoked = (email: string, reason: string): AuditEntry => ({
   action: "invite.revoke",
   target: email,
   detail: { reason },
});

// hold the server row lock: revoked invites must not revive if permissions are restored.
const revokeInvalidInvites = async (
   tx: Prisma.TransactionClient,
   serverId: string
): Promise<AuditEntry[]> => {
   const invites = await tx.pendingInvitation.findMany({
      where: { serverId },
      select: {
         id: true,
         email: true,
         expiresAt: true,
         invitedById: true,
         serverId: true,
         role: true,
         bucketAccess: { select: bucketGrantSelect },
      },
   });
   const valid = new Set((await stillGrantable(tx, invites)).map((i) => i.id));
   const invalid = invites.filter((i) => !valid.has(i.id));
   if (invalid.length === 0) return [];
   await tx.pendingInvitation.deleteMany({
      where: { id: { in: invalid.map((i) => i.id) } },
   });
   const now = new Date();
   return invalid
      .filter((i) => i.expiresAt > now)
      .map((i) => inviteRevoked(i.email, "sender_authority"));
};

export {
   inviteRevoked,
   revokeInvalidInvites,
   senderCanStillGrant,
   stillGrantable,
};
