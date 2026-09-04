import { env } from "@/lib/env";
import { ApiHttpError, noContent } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getAuth, requireUser } from "@/lib/middleware/authorize";
import { inviteLimit } from "@/lib/middleware/rate-limit";
import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { exceedsPendingInviteCap } from "@/lib/services/invite-cap";
import {
   inviteExpiry,
   inviteSelect,
   invitesUrl,
   toServerInvite,
} from "@/lib/services/invites";
import { assertBucketGrants } from "@/lib/services/members";
import { loadServerSettings } from "@/lib/services/servers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { sendServerInviteEmail } from "@s3-viewer/email";
import { Permission, ROLE_LABELS, canManageRole } from "@s3-viewer/permissions";
import {
   MAX_PENDING_INVITES,
   Role,
   revokeInviteSchema,
   sendInviteSchema,
   serverScope,
   type RevokeInviteInput,
   type SendInviteInput,
   type SendInviteResult,
   type ServerInvite,
   type ServerScope,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const serverInvitesRouter: Router = Router();

const getInvites = async (_req: Request, res: Response) => {
   const { serverId } = input<ServerScope>(res);
   const rows = await prisma.pendingInvitation.findMany({
      where: { serverId },
      select: inviteSelect,
      orderBy: { createdAt: "desc" },
   });
   res.json({ invites: rows.map(toServerInvite) });
};

const memberEmails = async (
   serverId: string,
   emails: string[]
): Promise<string[]> => {
   const rows = await prisma.serverAccess.findMany({
      where: { serverId, user: { email: { in: emails } } },
      select: { user: { select: { email: true } } },
   });
   return rows.map((r) => r.user.email.toLowerCase());
};

const assertCanReplaceInvites = async (
   serverId: string,
   emails: string[],
   actorRole: Role
): Promise<void> => {
   const existing = await prisma.pendingInvitation.findMany({
      where: { serverId, email: { in: emails }, expiresAt: { gt: new Date() } },
      select: { email: true, role: true },
   });
   const blocked = existing.find(
      (i) => !canManageRole(actorRole, Role[i.role])
   );
   if (blocked) {
      throw new ApiHttpError(
         403,
         `${blocked.email} already has a pending ${ROLE_LABELS[Role[blocked.role]]} invite you can't replace`
      );
   }
};

type InviteWrite = Pick<SendInviteInput, "role" | "bucketAccess"> & {
   serverId: string;
   invitedById: string;
   expiresAt: Date;
};

const writeInvites = async (
   client: Prisma.TransactionClient,
   emails: string[],
   w: InviteWrite
): Promise<ServerInvite[]> => {
   if (emails.length === 0) return [];

   const existing = await client.pendingInvitation.findMany({
      where: { serverId: w.serverId, email: { in: emails } },
      select: { id: true, email: true },
   });
   const existingEmails = existing.map((row) => row.email);
   const fresh = emails.filter((email) => !existingEmails.includes(email));

   if (fresh.length > 0) {
      await client.pendingInvitation.createMany({
         data: fresh.map((email) => ({
            email,
            serverId: w.serverId,
            role: w.role,
            expiresAt: w.expiresAt,
            invitedById: w.invitedById,
         })),
         skipDuplicates: true,
      });
   }

   if (existing.length > 0) {
      await client.pendingInvitation.updateMany({
         where: { serverId: w.serverId, email: { in: existingEmails } },
         data: {
            role: w.role,
            expiresAt: w.expiresAt,
            invitedById: w.invitedById,
         },
      });
      await client.invitationBucketAccess.deleteMany({
         where: { invitationId: { in: existing.map((row) => row.id) } },
      });
   }

   if (w.bucketAccess.length > 0) {
      const ids = await client.pendingInvitation.findMany({
         where: { serverId: w.serverId, email: { in: emails } },
         select: { id: true },
      });
      await client.invitationBucketAccess.createMany({
         data: ids.flatMap((row) =>
            w.bucketAccess.map((grant) => ({
               ...grant,
               invitationId: row.id,
            }))
         ),
         skipDuplicates: true,
      });
   }

   const rows = await client.pendingInvitation.findMany({
      where: { serverId: w.serverId, email: { in: emails } },
      select: inviteSelect,
   });
   const byEmail = new Map(rows.map((row) => [row.email, row]));
   return emails.map((email) => {
      const row = byEmail.get(email);
      if (!row) throw new ApiHttpError(500, "Invite could not be saved");
      return toServerInvite(row);
   });
};

const emailInvites = async (
   invites: ServerInvite[],
   inviterName: string,
   url: string,
   serverId: string
): Promise<void> => {
   const outcomes = await Promise.allSettled(
      invites.map((invite) =>
         sendServerInviteEmail({
            to: invite.email,
            inviterName,
            serverName: invite.server.name,
            role: invite.role,
            expiresAt: new Date(invite.expiresAt),
            invitesUrl: url,
         })
      )
   );
   const failed = outcomes.filter((o) => o.status === "rejected").length;
   if (failed > 0) {
      logger.warn("Invite emails failed", {
         serverId,
         failed,
         total: invites.length,
      });
   }
};

const assertUnderPendingCap = async (
   tx: Prisma.TransactionClient,
   serverId: string,
   pending: string[]
): Promise<void> => {
   if (pending.length === 0) return;
   await tx.pendingInvitation.deleteMany({
      where: { serverId, expiresAt: { lte: new Date() } },
   });
   const existingTotal = await tx.pendingInvitation.count({
      where: { serverId },
   });
   const alreadyInvited = await tx.pendingInvitation.findMany({
      where: { serverId, email: { in: pending } },
      select: { email: true },
   });
   const newInvites = pending.length - alreadyInvited.length;
   if (exceedsPendingInviteCap(existingTotal, newInvites)) {
      const contact = env.SUPPORT_EMAIL
         ? ` or contact ${env.SUPPORT_EMAIL} for a higher limit`
         : "";
      throw new ApiHttpError(
         409,
         `This server already has ${existingTotal} pending invites, and can have at most ${MAX_PENDING_INVITES}. Revoke some existing invites${contact}.`
      );
   }
};

const sendInvites = async (req: Request, res: Response) => {
   const actor = requireUser(req);
   const { serverId, emails, role, bucketAccess } = input<SendInviteInput>(res);
   const { serverRole } = getAuth(res);
   if (!canManageRole(serverRole, Role[role])) {
      throw new ApiHttpError(403, "You can't invite with that role");
   }
   const [{ allowedBuckets }, alreadyMembers] = await Promise.all([
      loadServerSettings(serverId),
      memberEmails(serverId, emails),
   ]);
   assertBucketGrants(serverRole, allowedBuckets, bucketAccess);

   const pending = emails.filter((e) => !alreadyMembers.includes(e));
   await assertCanReplaceInvites(serverId, pending, serverRole);

   const write: InviteWrite = {
      serverId,
      role,
      bucketAccess,
      invitedById: actor.id,
      expiresAt: inviteExpiry(),
   };
   const invites = await prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
         SELECT pg_try_advisory_xact_lock(hashtext(${serverId})::bigint) AS locked
      `;
      if (!locked) {
         throw new ApiHttpError(
            409,
            "Another invite is being sent for this server. Try again."
         );
      }
      await assertUnderPendingCap(tx, serverId, pending);
      return writeInvites(tx, pending, write);
   });
   await emailInvites(invites, actor.name, invitesUrl, serverId);
   const result: SendInviteResult = { invites, alreadyMembers };
   res.json(result);
};

const revokeInvite = async (_req: Request, res: Response) => {
   const { serverId, inviteId } = input<RevokeInviteInput>(res);
   const { serverRole } = getAuth(res);
   const invite = await prisma.pendingInvitation.findUnique({
      where: { id: inviteId, serverId },
      select: { role: true },
   });
   if (!invite) throw new ApiHttpError(404, "Invite not found");
   if (!canManageRole(serverRole, Role[invite.role])) {
      throw new ApiHttpError(403, "You can't revoke that invite");
   }
   await prisma.pendingInvitation.deleteMany({
      where: { id: inviteId, serverId },
   });
   noContent(res);
};

serverInvitesRouter.get(
   "/:serverId/invites",
   ...serverRoute(Permission.MANAGE_MEMBERS, serverScope, getInvites)
);
serverInvitesRouter.post(
   "/:serverId/invites",
   inviteLimit,
   ...serverRoute(Permission.MANAGE_MEMBERS, sendInviteSchema, sendInvites)
);
serverInvitesRouter.delete(
   "/:serverId/invites/:inviteId",
   ...serverRoute(Permission.MANAGE_MEMBERS, revokeInviteSchema, revokeInvite)
);

export { serverInvitesRouter };
