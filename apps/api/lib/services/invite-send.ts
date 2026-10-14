import { SERVER_NOT_FOUND } from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { LOCK_NAMESPACE, tryXactLock } from "@/lib/db-locks";
import type { SessionUser } from "@/lib/middleware/auth";
import {
   AccessDenied,
   denied,
   type DenialScope,
} from "@/lib/middleware/authorize";
import { recordManyFor } from "@/lib/middleware/audit-record";
import { recordDenial } from "@/lib/middleware/route";
import { folderColumns } from "./bucket-grants";
import { canRevokeInvite, revocableInviteSelect } from "./invite-authority";
import { reserveInviteEmails } from "./invite-email-budget";
import {
   inviteExpiry,
   inviteSelect,
   inviteToken,
   invitesUrl,
   toServerInvite,
} from "./invites";
import {
   assertBucketGrants,
   bucketDetail,
   loadGrantingActor,
   memberRole,
} from "./members";
import { auditScopeOf, lockServerRow, type AuditScope } from "./servers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import { sendServerInviteEmail } from "@s3-viewer/email";
import {
   Permission,
   canManageRole,
   hasPermission,
} from "@s3-viewer/permissions";
import {
   GENERIC_ERROR_MESSAGE,
   MAX_PENDING_INVITES,
   Role,
   describeError,
   normalizeEmail,
   type AuditEntry,
   type InviteOutcome,
   type InviteTarget,
   type SendInvitesInput,
   type SendInvitesResult,
   type ServerInvite,
} from "@s3-viewer/types";

type Actor = Pick<SessionUser, "id" | "email" | "name">;

type InviteWrite = Pick<InviteTarget, "serverId" | "role" | "bucketAccess"> & {
   invitedById: string;
   expiresAt: Date;
};

type SavedInvite = { invite: ServerInvite; token: string; renewed: boolean };

type SavedTarget = {
   serverId: string;
   saved: SavedInvite[];
   alreadyMembers: string[];
   audit: AuditScope;
};

type TargetResult =
   | { ok: true; target: SavedTarget }
   | { ok: false; serverId: string; error: string };

const BUSY = "Another invite is being sent for this server. Try again.";

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
   emails: string[],
   actorRole: Role,
   scope: DenialScope,
   db: Prisma.TransactionClient
): Promise<void> => {
   const { serverId, actorId } = scope;
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
      throw denied(
         403,
         `${blocked.email} already has a pending invite with access you can't replace`,
         scope,
         Permission.MANAGE_MEMBERS,
         "member"
      );
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

// the authorize middleware cannot gate a body naming many servers, so each target is checked here under its own lock.
const invitingRole = async (
   tx: Prisma.TransactionClient,
   scope: DenialScope,
   invited: Role
): Promise<Role> => {
   const role = await memberRole(tx, scope.actorId, scope.serverId);
   // a stranger gets the same 404 as a missing server, so ids cannot be probed and no denial lands in a server's log
   if (!role) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   const refused = (message: string, reason: "forbidden" | "member") =>
      denied(403, message, scope, Permission.MANAGE_MEMBERS, reason);
   if (!hasPermission(role, Permission.MANAGE_MEMBERS))
      throw refused("You don't have permission to do that", "forbidden");
   if (!canManageRole(role, invited))
      throw refused("You can't invite with that role", "member");
   return role;
};

const saveTarget = (
   actor: Actor,
   emails: string[],
   target: InviteTarget,
   expiresAt: Date
): Promise<SavedTarget> =>
   prisma.$transaction(async (tx) => {
      const { serverId, role, bucketAccess } = target;
      if (!(await tryXactLock(tx, LOCK_NAMESPACE.INVITE_SEND, serverId)))
         throw new ApiHttpError(409, BUSY);
      const server = await lockServerRow(tx, serverId, [
         "restrictedBuckets",
         "allowedBuckets",
         "auditEnabled",
         "auditLevel",
      ]);
      const audit = auditScopeOf(server);
      const scope: DenialScope = { serverId, actorId: actor.id, audit };
      const currentRole = await invitingRole(tx, scope, Role[role]);
      const [alreadyMembers, granting] = await Promise.all([
         memberEmails(serverId, emails, tx),
         loadGrantingActor(actor.id, serverId, currentRole, bucketAccess, tx),
      ]);
      assertBucketGrants(granting, server, bucketAccess);
      const pending = emails.filter((e) => !alreadyMembers.includes(e));
      await assertCanReplaceInvites(pending, currentRole, scope, tx);
      await assertUnderPendingCap(tx, serverId, pending);
      const saved = await writeInvites(tx, pending, {
         serverId,
         role,
         bucketAccess,
         invitedById: actor.id,
         expiresAt,
      });
      return { serverId, saved, alreadyMembers, audit };
   });

// one refused or failing server never blocks the others; the client renders each outcome.
const trySaveTarget = async (
   actor: Actor,
   emails: string[],
   target: InviteTarget,
   expiresAt: Date
): Promise<TargetResult> => {
   const { serverId } = target;
   try {
      return {
         ok: true,
         target: await saveTarget(actor, emails, target, expiresAt),
      };
   } catch (error) {
      if (error instanceof AccessDenied)
         await recordDenial(error.denial, actor.email);
      if (error instanceof ApiHttpError)
         return { ok: false, serverId, error: error.message };
      logger.error("Invite send failed", {
         serverId,
         error: describeError(error),
      });
      return { ok: false, serverId, error: GENERIC_ERROR_MESSAGE };
   }
};

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

// one email per recipient listing every server that saved an invite for them; returns the ids it carried.
// the link prefers a fresh invite's token; a renewed one is rotated only once an email will carry it, so a
// skipped send never kills the link already in the inbox.
const emailRecipient = async (
   email: string,
   saved: SavedInvite[],
   inviter: Actor,
   expiresAt: Date
): Promise<Set<string>> => {
   const reservation = await reserveInviteEmails(
      saved.map(({ invite }) => invite.server.id),
      email
   );
   if (!reservation) return new Set();
   const included = saved.filter(({ invite }) =>
      reservation.servers.includes(invite.server.id)
   );
   const carrier = included.find(({ renewed }) => !renewed) ?? included[0];
   if (!carrier) return new Set();
   const link = carrier.renewed ? inviteToken() : carrier.token;
   const restore = () =>
      carrier.renewed
         ? swapToken(carrier.invite.id, link, carrier.token).catch(() => {})
         : Promise.resolve();
   try {
      if (
         carrier.renewed &&
         !(await swapToken(carrier.invite.id, carrier.token, link))
      ) {
         await reservation.release().catch(() => {});
         return new Set();
      }
      await sendServerInviteEmail({
         to: email,
         inviterName: inviter.name,
         inviterEmail: inviter.email,
         servers: included.map(({ invite }) => ({
            serverName: invite.server.name,
            role: invite.role,
         })),
         expiresAt,
         invitesUrl: invitesUrl(link),
      });
      return new Set(included.map(({ invite }) => invite.id));
   } catch (error) {
      await Promise.all([reservation.release().catch(() => {}), restore()]);
      logger.warn("Invite email failed", {
         servers: included.map(({ invite }) => invite.server.id),
         error: describeError(error),
      });
      return new Set();
   }
};

const sendEmails = async (
   targets: SavedTarget[],
   inviter: Actor,
   expiresAt: Date
): Promise<Set<string>> => {
   const byEmail = new Map<string, SavedInvite[]>();
   for (const { saved } of targets) {
      for (const entry of saved) {
         const list = byEmail.get(entry.invite.email) ?? [];
         list.push(entry);
         byEmail.set(entry.invite.email, list);
      }
   }
   const carried = await Promise.all(
      [...byEmail].map(([email, saved]) =>
         emailRecipient(email, saved, inviter, expiresAt)
      )
   );
   return new Set(carried.flatMap((ids) => [...ids]));
};

const sendInvites = async (
   actor: Actor,
   { emails, targets, notify }: SendInvitesInput
): Promise<SendInvitesResult> => {
   const expiresAt = inviteExpiry();
   const results: TargetResult[] = [];
   for (const target of targets)
      results.push(await trySaveTarget(actor, emails, target, expiresAt));
   const savedTargets = results.flatMap((result) =>
      result.ok ? [result.target] : []
   );
   const emailed = notify
      ? await sendEmails(savedTargets, actor, expiresAt)
      : new Set<string>();
   await Promise.all(
      savedTargets.map(({ serverId, saved, audit }) =>
         recordManyFor(
            actor,
            serverId,
            audit,
            saved.map(
               ({ invite }): AuditEntry => ({
                  action: "invite.send",
                  target: invite.email,
                  detail: {
                     role: invite.role,
                     ...bucketDetail(invite.bucketAccess),
                  },
               })
            )
         )
      )
   );
   return {
      outcomes: results.map(
         (result): InviteOutcome =>
            result.ok
               ? {
                    serverId: result.target.serverId,
                    invites: result.target.saved.map(({ invite }) => ({
                       ...invite,
                       emailed: emailed.has(invite.id),
                    })),
                    alreadyMembers: result.target.alreadyMembers,
                    error: null,
                 }
               : {
                    serverId: result.serverId,
                    invites: [],
                    alreadyMembers: [],
                    error: result.error,
                 }
      ),
   };
};

export { sendInvites };
