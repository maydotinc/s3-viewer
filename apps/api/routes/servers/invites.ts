import { ApiHttpError, noContent } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getAuth, requireUser } from "@/lib/middleware/authorize";
import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import {
   inviteExpiry,
   inviteSelect,
   invitesUrl,
   toServerInvite,
} from "@/lib/services/invites";
import { assertBucketGrants } from "@/lib/services/members";
import { loadServerSettings } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { sendServerInviteEmail } from "@s3-viewer/email";
import { Permission, ROLE_LABELS, canManageRole } from "@s3-viewer/permissions";
import {
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
      where: { serverId, user: { email: { in: emails, mode: "insensitive" } } },
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

const upsertInvite = (email: string, w: InviteWrite) =>
   prisma.pendingInvitation.upsert({
      where: { email_serverId: { email, serverId: w.serverId } },
      update: {
         role: w.role,
         expiresAt: w.expiresAt,
         invitedById: w.invitedById,
         bucketAccess: { deleteMany: {}, create: w.bucketAccess },
      },
      create: {
         email,
         serverId: w.serverId,
         role: w.role,
         expiresAt: w.expiresAt,
         invitedById: w.invitedById,
         bucketAccess: { create: w.bucketAccess },
      },
      select: inviteSelect,
   });

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

const sendInvites = async (req: Request, res: Response) => {
   const actor = requireUser(req);
   const { serverId, emails, role, bucketAccess } = input<SendInviteInput>(res);
   const { serverRole } = getAuth(res);
   if (!canManageRole(serverRole, Role[role])) {
      throw new ApiHttpError(403, "You can't invite with that role");
   }
   const { allowedBuckets } = await loadServerSettings(serverId);
   assertBucketGrants(serverRole, allowedBuckets, bucketAccess);

   const alreadyMembers = await memberEmails(serverId, emails);
   const pending = emails.filter((e) => !alreadyMembers.includes(e));
   await assertCanReplaceInvites(serverId, pending, serverRole);

   const write: InviteWrite = {
      serverId,
      role,
      bucketAccess,
      invitedById: actor.id,
      expiresAt: inviteExpiry(),
   };
   const rows = await prisma.$transaction(
      pending.map((e) => upsertInvite(e, write))
   );
   const invites = rows.map(toServerInvite);
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
   ...serverRoute(Permission.MANAGE_MEMBERS, sendInviteSchema, sendInvites)
);
serverInvitesRouter.delete(
   "/:serverId/invites/:inviteId",
   ...serverRoute(Permission.MANAGE_MEMBERS, revokeInviteSchema, revokeInvite)
);

export { serverInvitesRouter };
