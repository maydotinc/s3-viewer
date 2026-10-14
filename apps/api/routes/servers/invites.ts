import { env } from "@/lib/env";
import { ApiHttpError, noContent } from "@/lib/http";
import { logger } from "@/lib/logger";
import { LOCK_NAMESPACE, tryXactLock } from "@/lib/db-locks";
import {
   getAuth,
   lockedPermission,
   refuse,
   requireUser,
} from "@/lib/middleware/authorize";
import { inviteLimit } from "@/lib/middleware/rate-limit";
import { memberRoute } from "@/lib/middleware/route";
import { record, recordMany } from "@/lib/middleware/audit-record";
import { reserveInviteEmail } from "@/lib/services/invite-email-budget";
import {
   inviteExpiry,
   inviteSelect,
   inviteToken,
   invitesUrl,
   toServerInvite,
} from "@/lib/services/invites";
import { folderColumns, withVisibleGrants } from "@/lib/services/bucket-grants";
import {
   canRevokeInvite,
   revocableInviteSelect,
} from "@/lib/services/invite-authority";
import {
   assertBucketGrants,
   bucketDetail,
   loadGrantingActor,
   memberRole,
   visibleBuckets,
} from "@/lib/services/members";
import { lockBucketScope } from "@/lib/services/servers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import { sendServerInviteEmail } from "@s3-viewer/email";
import { Permission, canManageRole } from "@s3-viewer/permissions";
import {
   MAX_PENDING_INVITES,
   Role,
   describeError,
   normalizeEmail,
   revokeInviteSchema,
   sendInviteSchema,
   serverScope,
   type AuditEntry,
   type InvitesResponse,
   type RevokeInviteInput,
   type SendInviteInput,
   type SendInviteResult,
   type ServerInvite,
   type ServerScope,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const serverInvitesRouter: Router = Router();
const INVITE_NOT_FOUND = "Invite not found";

const getInvites = async (_req: Request, res: Response, input: ServerScope) => {
   const { serverId } = input;
   const { userId, serverRole } = getAuth(res);
   const [rows, visible] = await Promise.all([
      prisma.pendingInvitation.findMany({
         where: { serverId, ...liveInvite() },
         select: inviteSelect,
         orderBy: { createdAt: "desc" },
      }),
      visibleBuckets(userId, serverId, serverRole),
   ]);
   const invites = rows.map((row) =>
      withVisibleGrants(visible, toServerInvite(row))
   );
   res.json({ invites } satisfies InvitesResponse);
};

const memberEmails = async (
   serverId: string,
   emails: string[],
   db: Prisma.TransactionClient
): Promise<string[]> => {
   const rows = await db.serverAccess.findMany({
      where: { serverId, user: { email: { in: emails } } },
      select: { user: { select: { email: true } } },
   });
   return rows.map((r) => normalizeEmail(r.user.email));
};

const assertCanReplaceInvites = async (
   serverId: string,
   emails: string[],
   actorId: string,
   actorRole: Role,
   db: Prisma.TransactionClient,
   res: Response
): Promise<void> => {
   const existing = await db.pendingInvitation.findMany({
      where: { serverId, email: { in: emails }, ...liveInvite() },
      select: revocableInviteSelect,
   });
   const actor = await loadGrantingActor(
      actorId,
      serverId,
      actorRole,
      existing.flatMap((invite) => invite.bucketAccess),
      db
   );
   const blocked = existing.find((invite) => !canRevokeInvite(actor, invite));
   if (blocked) {
      throw refuse(
         res,
         Permission.MANAGE_MEMBERS,
         "member",
         `${blocked.email} already has a pending invite with access you can't replace`
      );
   }
};

type InviteWrite = Pick<SendInviteInput, "role" | "bucketAccess"> & {
   serverId: string;
   invitedById: string;
   expiresAt: Date;
};

type SavedInvite = { invite: ServerInvite; token: string; renewed: boolean };

const writeInvites = async (
   client: Prisma.TransactionClient,
   emails: string[],
   w: InviteWrite
): Promise<SavedInvite[]> => {
   if (emails.length === 0) return [];

   const existing = await client.pendingInvitation.findMany({
      where: { serverId: w.serverId, email: { in: emails } },
      select: { id: true, email: true },
   });
   const existingEmails = existing.map((row) => row.email);
   const fresh = emails.filter((email) => !existingEmails.includes(email));

   const created =
      fresh.length > 0
         ? await client.pendingInvitation.createManyAndReturn({
              data: fresh.map((email) => ({
                 email,
                 token: inviteToken(),
                 serverId: w.serverId,
                 role: w.role,
                 expiresAt: w.expiresAt,
                 invitedById: w.invitedById,
              })),
              skipDuplicates: true,
              select: { id: true },
           })
         : [];

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
      await client.invitationBucketAccess.createMany({
         data: [...existing, ...created].flatMap((row) =>
            w.bucketAccess.map(({ bucketName, role, folders }) => ({
               bucketName,
               role,
               ...folderColumns(folders),
               invitationId: row.id,
            }))
         ),
         skipDuplicates: true,
      });
   }

   const rows = await client.pendingInvitation.findMany({
      where: { serverId: w.serverId, email: { in: emails } },
      select: { ...inviteSelect, token: true },
   });
   const byEmail = new Map(rows.map((row) => [row.email, row]));
   return emails.map((email) => {
      const row = byEmail.get(email);
      if (!row) throw new ApiHttpError(500, "Invite could not be saved");
      return {
         invite: toServerInvite(row),
         token: row.token,
         renewed: existingEmails.includes(email),
      };
   });
};

type Inviter = { name: string; email: string };

// matching on the old token leaves alone an invite revoked, accepted or re-sent since the commit.
const swapToken = async (
   inviteId: string,
   from: string,
   to: string
): Promise<boolean> =>
   (
      await prisma.pendingInvitation.updateMany({
         where: { id: inviteId, token: from },
         data: { token: to },
      })
   ).count === 1;

// a renewed invite gets a new link only once an email will carry it, so a skipped send never kills the link already in the inbox.
const emailInvite = async (
   { invite, token, renewed }: SavedInvite,
   inviter: Inviter,
   serverId: string
): Promise<boolean> => {
   const reservation = await reserveInviteEmail(serverId, invite.email);
   if (!reservation) return false;
   const link = renewed ? inviteToken() : token;
   try {
      if (renewed && !(await swapToken(invite.id, token, link))) {
         await reservation.release().catch(() => {});
         return false;
      }
      await sendServerInviteEmail({
         to: invite.email,
         inviterName: inviter.name,
         inviterEmail: inviter.email,
         serverName: invite.server.name,
         role: invite.role,
         expiresAt: new Date(invite.expiresAt),
         invitesUrl: invitesUrl(link),
      });
      return true;
   } catch (error) {
      await reservation.release().catch(() => {});
      if (renewed) await swapToken(invite.id, link, token).catch(() => {});
      logger.warn("Invite email failed", {
         serverId,
         inviteId: invite.id,
         error: describeError(error),
      });
      return false;
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
   if (newInvites > 0 && existingTotal + newInvites > MAX_PENDING_INVITES) {
      const contact = env.SUPPORT_EMAIL
         ? ` or contact ${env.SUPPORT_EMAIL} for a higher limit`
         : "";
      throw new ApiHttpError(
         409,
         `This server already has ${existingTotal} pending invites, and can have at most ${MAX_PENDING_INVITES}. Revoke some existing invites${contact}.`
      );
   }
};

const invitingRole = (
   res: Response,
   actorRole: Role | null,
   invited: Role
): Role => {
   if (!actorRole || !canManageRole(actorRole, invited)) {
      throw refuse(
         res,
         Permission.MANAGE_MEMBERS,
         "member",
         "You can't invite with that role"
      );
   }
   return actorRole;
};

const sendInvites = async (
   req: Request,
   res: Response,
   input: SendInviteInput
) => {
   const actor = requireUser(req);
   const { serverId, emails, role, bucketAccess } = input;
   invitingRole(res, getAuth(res).serverRole, Role[role]);
   const write: InviteWrite = {
      serverId,
      role,
      bucketAccess,
      invitedById: actor.id,
      expiresAt: inviteExpiry(),
   };
   const { saved, alreadyMembers } = await prisma.$transaction(async (tx) => {
      if (!(await tryXactLock(tx, LOCK_NAMESPACE.INVITE_SEND, serverId))) {
         throw new ApiHttpError(
            409,
            "Another invite is being sent for this server. Try again."
         );
      }
      const scope = await lockBucketScope(tx, serverId);
      const currentRole = invitingRole(
         res,
         await memberRole(tx, actor.id, serverId),
         Role[role]
      );
      const [alreadyMembers, granting] = await Promise.all([
         memberEmails(serverId, emails, tx),
         loadGrantingActor(actor.id, serverId, currentRole, bucketAccess, tx),
      ]);
      assertBucketGrants(granting, scope, bucketAccess);
      const pending = emails.filter((e) => !alreadyMembers.includes(e));
      await assertCanReplaceInvites(
         serverId,
         pending,
         actor.id,
         currentRole,
         tx,
         res
      );
      await assertUnderPendingCap(tx, serverId, pending);
      return {
         saved: await writeInvites(tx, pending, write),
         alreadyMembers,
      };
   });
   const invites = saved.map(({ invite }) => invite);
   const emailed = await Promise.all(
      saved.map((entry) => emailInvite(entry, actor, serverId))
   );
   await recordMany(
      res,
      invites.map(
         (invite): AuditEntry => ({
            action: "invite.send",
            target: invite.email,
            detail: { role: invite.role, ...bucketDetail(invite.bucketAccess) },
         })
      )
   );
   const result: SendInviteResult = {
      invites: invites.map((invite, index) => ({
         ...invite,
         emailed: emailed[index] ?? false,
      })),
      alreadyMembers,
   };
   res.json(result);
};

const revokeInvite = async (
   _req: Request,
   res: Response,
   input: RevokeInviteInput
) => {
   const { serverId, inviteId } = input;
   const invite = await prisma.$transaction(async (tx) => {
      await lockBucketScope(tx, serverId);
      const [actorRole, invite] = await Promise.all([
         lockedPermission(tx, res, serverId, Permission.MANAGE_MEMBERS),
         tx.pendingInvitation.findUnique({
            where: { id: inviteId, serverId },
            select: revocableInviteSelect,
         }),
      ]);
      if (!invite) throw new ApiHttpError(404, INVITE_NOT_FOUND);
      const actor = await loadGrantingActor(
         getAuth(res).userId,
         serverId,
         actorRole,
         invite.bucketAccess,
         tx
      );
      if (!canRevokeInvite(actor, invite)) {
         throw refuse(
            res,
            Permission.MANAGE_MEMBERS,
            "member",
            "You can't revoke that invite"
         );
      }
      const { count } = await tx.pendingInvitation.deleteMany({
         where: { id: inviteId, serverId },
      });
      if (count === 0) throw new ApiHttpError(404, INVITE_NOT_FOUND);
      return invite;
   });
   await record(res, { action: "invite.revoke", target: invite.email });
   noContent(res);
};

serverInvitesRouter.get(
   "/:serverId/invites",
   ...memberRoute(serverScope, getInvites)
);
serverInvitesRouter.post(
   "/:serverId/invites",
   inviteLimit,
   ...memberRoute(sendInviteSchema, sendInvites)
);
serverInvitesRouter.delete(
   "/:serverId/invites/:inviteId",
   ...memberRoute(revokeInviteSchema, revokeInvite)
);

export { serverInvitesRouter };
