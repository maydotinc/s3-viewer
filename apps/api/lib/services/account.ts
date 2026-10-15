import { writeAudits } from "@/lib/audit/writer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { invalidateS3Client } from "@/lib/s3/client-cache";
import { inviteRevoked } from "./invite-authority";
import { auditScopeOf, auditScopeSelect, type AuditScope } from "./servers";
import type { DeletedUser, UserDeletionHooks } from "@s3-viewer/auth";
import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import { sendAccountDeletedEmail } from "@s3-viewer/email";
import {
   MINUTE_MS,
   describeError,
   normalizeEmail,
   type AccountSummary,
   type AuditEntry,
} from "@s3-viewer/types";

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
            where: { email: normalizeEmail(user.email), ...liveInvite() },
         }),
      ]
   );
   return {
      user: { id: user.id, email: user.email },
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

type Departure = { serverId: string; audit: AuditScope; entries: AuditEntry[] };
type DeletionStash = { ids: string[]; departures: Departure[]; at: number };

const ACCOUNT_DELETED = "account_deleted";

// stashes older than this are dropped when afterDelete never ran.
const STASH_TTL_MS = 5 * MINUTE_MS;
const deletionStashOf = new Map<string, DeletionStash>();

const stashDeletion = (
   userId: string,
   ids: string[],
   departures: Departure[]
): void => {
   const now = Date.now();
   for (const [key, stash] of deletionStashOf) {
      if (now - stash.at > STASH_TTL_MS) deletionStashOf.delete(key);
   }
   deletionStashOf.set(userId, { ids, departures, at: now });
};

const departuresOf = async (userId: string): Promise<Departure[]> => {
   const memberships = await prisma.serverAccess.findMany({
      where: { userId, server: { ownerId: { not: userId } } },
      select: {
         serverId: true,
         server: {
            select: {
               ...auditScopeSelect,
               pendingInvitations: {
                  where: { invitedById: userId, ...liveInvite() },
                  select: { email: true },
               },
            },
         },
      },
   });
   return memberships.map(({ serverId, server }) => ({
      serverId,
      audit: auditScopeOf(server),
      entries: [
         { action: "server.leave", detail: { reason: ACCOUNT_DELETED } },
         ...server.pendingInvitations.map((invite) =>
            inviteRevoked(invite.email, ACCOUNT_DELETED)
         ),
      ],
   }));
};

const eraseAccountData = async (user: DeletedUser): Promise<void> => {
   const owned = await prisma.server.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true, ...auditScopeSelect },
   });
   // written whether or not the server audits, like an explicit DELETE /servers/:id.
   const deletions: Departure[] = owned.map((server) => ({
      serverId: server.id,
      audit: { ...auditScopeOf(server), enabled: true },
      entries: [
         {
            action: "server.delete",
            detail: { name: server.name, reason: ACCOUNT_DELETED },
         },
      ],
   }));
   stashDeletion(
      user.id,
      owned.map((server) => server.id),
      [...deletions, ...(await departuresOf(user.id))]
   );
};

// invites are keyed by address, so they survive the user cascade and are cleared only once the account is really gone.
const removeAddressedInvites = async (user: DeletedUser): Promise<void> => {
   if (!user.emailVerified) return;
   await prisma.pendingInvitation.deleteMany({
      where: { email: normalizeEmail(user.email) },
   });
};

const recordDepartures = (
   user: DeletedUser,
   departures: readonly Departure[]
): Promise<void[]> =>
   Promise.all(
      departures.map(({ serverId, audit, entries }) =>
         writeAudits({
            serverId,
            actor: { id: user.id, email: user.email },
            audit,
            entries,
         })
      )
   );

const finishAccountDeletion = async (user: DeletedUser): Promise<void> => {
   const stash = deletionStashOf.get(user.id);
   deletionStashOf.delete(user.id);
   // invalidate after the cascade so a racing request cannot refill the cache.
   for (const serverId of stash?.ids ?? []) invalidateS3Client(serverId);
   try {
      await removeAddressedInvites(user);
   } catch (err) {
      logger.error("Account deletion invite cleanup failed", {
         error: describeError(err),
      });
   }
   try {
      await recordDepartures(user, stash?.departures ?? []);
   } catch (err) {
      logger.error("Account deletion audit failed", {
         error: describeError(err),
      });
   }
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

const sharedServerNames = async (userId: string): Promise<string[]> => {
   const servers = await prisma.server.findMany({
      where: {
         ownerId: userId,
         serverAccess: { some: { userId: { not: userId } } },
      },
      select: { name: true },
      orderBy: { name: "asc" },
   });
   return servers.map((server) => server.name);
};

const accountDeletionHooks: UserDeletionHooks = {
   sharedServerNames,
   beforeDelete: eraseAccountData,
   afterDelete: finishAccountDeletion,
};

export { accountDeletionHooks, accountSummary };
