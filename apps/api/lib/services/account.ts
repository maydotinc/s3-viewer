import { env } from "@/lib/env";
import { describeError, logger } from "@/lib/logger";
import { invalidateS3Client } from "@/lib/s3/client-cache";
import { recordAudit } from "@/lib/services/audit";
import { addressedTo } from "@/lib/services/invites";
import type { DeletedUser, UserDeletionHooks } from "@s3-viewer/auth";
import { prisma } from "@s3-viewer/db";
import { sendAccountDeletedEmail } from "@s3-viewer/email";
import type { AccountSummary } from "@s3-viewer/types";

const DELETED_USER_TARGET = "[deleted user]";

const liveInvite = () => ({ expiresAt: { gt: new Date() } });

const accountSummary = async (
   user: Pick<DeletedUser, "id" | "email">
): Promise<AccountSummary> => {
   const notOwned = { server: { ownerId: { not: user.id } } };
   const [owned, memberships, sentInvites, receivedInvites] = await Promise.all(
      [
         prisma.server.findMany({
            where: { ownerId: user.id },
            select: {
               id: true,
               name: true,
               _count: {
                  select: {
                     serverAccess: { where: { userId: { not: user.id } } },
                     pendingInvitations: { where: liveInvite() },
                  },
               },
            },
            orderBy: { name: "asc" },
         }),
         prisma.serverAccess.count({ where: { userId: user.id, ...notOwned } }),
         prisma.pendingInvitation.count({
            where: { invitedById: user.id, ...notOwned, ...liveInvite() },
         }),
         prisma.pendingInvitation.count({
            where: { email: addressedTo(user.email), ...liveInvite() },
         }),
      ]
   );
   return {
      ownedServers: owned.map((server) => ({
         id: server.id,
         name: server.name,
         memberCount: server._count.serverAccess,
         pendingInviteCount: server._count.pendingInvitations,
      })),
      memberships,
      sentInvites,
      receivedInvites,
   };
};

// owned server ids are collected before the user row (and its cascade) is
// gone, then their cached s3 clients are dropped only after the cascade, so a
// request racing the deletion cannot refill the cache with credentials of a
// server that no longer exists
const ownedServersOf = new Map<string, string[]>();

const eraseAccountData = async (user: DeletedUser): Promise<void> => {
   const ownedServerIds = await prisma.$transaction(async (tx) => {
      const owned = await tx.server.findMany({
         where: { ownerId: user.id },
         select: { id: true },
      });
      await tx.pendingInvitation.deleteMany({
         where: { email: addressedTo(user.email) },
      });
      await tx.auditLog.updateMany({
         where: { target: user.email },
         data: { target: DELETED_USER_TARGET },
      });
      return owned.map((server) => server.id);
   });
   ownedServersOf.set(user.id, ownedServerIds);
};

const finishAccountDeletion = async (user: DeletedUser): Promise<void> => {
   const ownedServerIds = ownedServersOf.get(user.id) ?? [];
   ownedServersOf.delete(user.id);
   for (const serverId of ownedServerIds) invalidateS3Client(serverId);
   await recordAudit({ action: "account.delete", actorId: user.id });
   try {
      await sendAccountDeletedEmail({
         to: user.email,
         name: user.name,
         supportEmail: env.SUPPORT_EMAIL,
      });
   } catch (err) {
      logger.error("Account deletion email failed", {
         error: describeError(err),
      });
   }
};

const accountDeletionHooks: UserDeletionHooks = {
   beforeDelete: eraseAccountData,
   afterDelete: finishAccountDeletion,
};

export {
   DELETED_USER_TARGET,
   accountDeletionHooks,
   accountSummary,
   eraseAccountData,
   finishAccountDeletion,
};
