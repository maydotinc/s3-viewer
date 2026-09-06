import type { Prisma, $Enums } from "@prisma/client";
import {
   canManageRole,
   effectiveBucketRole,
   isAtLeast,
} from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { isBucketAllowed } from "./servers";

type InviteAuthority = {
   invitedById: string;
   serverId: string;
   role: $Enums.Role;
   bucketAccess: readonly { bucketName: string; role: $Enums.Role }[];
};

const senderKey = (userId: string, serverId: string) => `${userId}:${serverId}`;

const stillGrantable = async <T extends InviteAuthority>(
   db: Prisma.TransactionClient,
   invites: readonly T[]
): Promise<T[]> => {
   if (invites.length === 0) return [];
   const where = {
      OR: invites.map(({ invitedById, serverId }) => ({
         userId: invitedById,
         serverId,
      })),
   };
   const [senders, grants] = await Promise.all([
      db.serverAccess.findMany({
         where,
         select: {
            userId: true,
            serverId: true,
            role: true,
            server: {
               select: { restrictedBuckets: true, allowedBuckets: true },
            },
         },
      }),
      db.bucketAccess.findMany({
         where,
         select: { userId: true, serverId: true, bucketName: true, role: true },
      }),
   ]);
   const actors = new Map(
      senders.map((s) => [senderKey(s.userId, s.serverId), s])
   );
   const bucketRoles = new Map(
      grants.map((g) => [
         `${senderKey(g.userId, g.serverId)}:${g.bucketName}`,
         Role[g.role],
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
            canManageRole(Role[actor.role], Role[grant.role]) &&
            isAtLeast(
               effectiveBucketRole(
                  Role[actor.role],
                  bucketRoles.get(`${key}:${grant.bucketName}`)
               ),
               Role[grant.role]
            )
      );
   });
};

const senderCanStillGrant = async (
   tx: Prisma.TransactionClient,
   invite: InviteAuthority
) => (await stillGrantable(tx, [invite])).length === 1;

// Call while holding the server row lock, after changing permissions. An
// invalid invite must not spring back to life if access is later restored.
const revokeInvalidInvites = async (
   tx: Prisma.TransactionClient,
   serverId: string
): Promise<void> => {
   const invites = await tx.pendingInvitation.findMany({
      where: { serverId },
      select: {
         id: true,
         invitedById: true,
         serverId: true,
         role: true,
         bucketAccess: { select: { bucketName: true, role: true } },
      },
   });
   const valid = new Set((await stillGrantable(tx, invites)).map((i) => i.id));
   const invalid = invites.filter((i) => !valid.has(i.id)).map((i) => i.id);
   if (invalid.length)
      await tx.pendingInvitation.deleteMany({ where: { id: { in: invalid } } });
};

export { revokeInvalidInvites, senderCanStillGrant, stillGrantable };
