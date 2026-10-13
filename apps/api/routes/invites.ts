import { decodeCursor, encodeCursor, pageOf } from "@/lib/cursor";
import { ApiHttpError, noContent } from "@/lib/http";
import { recordFor } from "@/lib/middleware/audit-record";
import { requireUser } from "@/lib/middleware/authorize";
import { validatedRoute } from "@/lib/middleware/route";
import {
   senderCanStillGrant,
   stillGrantable,
} from "@/lib/services/invite-authority";
import {
   grantBucketRoles,
   grantServerRole,
   receivedInvitePage,
   sentInvitePage,
   toServerInvite,
} from "@/lib/services/invites";
import { bucketGrantSelect } from "@/lib/services/bucket-grants";
import {
   assertNotLimited,
   bucketDetail,
   loadBucketGrants,
} from "@/lib/services/members";
import {
   auditScopeOf,
   auditScopeSelect,
   lockBucketScope,
   serverInfoSelect,
   toServerInfo,
} from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   Role,
   inviteIdSchema,
   normalizeEmail,
   pageSchema,
   type InviteIdInput,
   type InvitesPage,
   type PageInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const invitesRouter: Router = Router();

const NOT_FOUND = "Invite not found or expired";
const RECEIVED_PASSES = 5;

const sameEmail = (a: string, b: string): boolean =>
   normalizeEmail(a) === normalizeEmail(b);

const listReceived = async (
   req: Request,
   res: Response,
   { cursor, limit }: PageInput
) => {
   const user = requireUser(req);
   let position = cursor ? decodeCursor(cursor) : undefined;
   const grantable: Awaited<ReturnType<typeof receivedInvitePage>> = [];
   let more = false;
   for (let pass = 0; pass < RECEIVED_PASSES; pass++) {
      const rows = await receivedInvitePage(user.email, position, limit + 1);
      grantable.push(...(await stillGrantable(prisma, rows)));
      position = rows.at(-1);
      more = rows.length > limit;
      if (grantable.length > limit || !more) break;
   }
   const { page, nextCursor } = pageOf(grantable, limit);
   res.json({
      invites: page.map(toServerInvite),
      nextCursor:
         nextCursor ?? (more && position ? encodeCursor(position) : null),
   } satisfies InvitesPage);
};

const MANAGING_ROLES = Object.values(Role).filter((role) =>
   hasPermission(role, Permission.MANAGE_MEMBERS)
);

const listSent = async (
   req: Request,
   res: Response,
   { cursor, limit }: PageInput
) => {
   const user = requireUser(req);
   const rows = await sentInvitePage(
      user.id,
      MANAGING_ROLES,
      cursor ? decodeCursor(cursor) : undefined,
      limit + 1
   );
   const { page, nextCursor } = pageOf(rows, limit);
   res.json({
      invites: page.map(toServerInvite),
      nextCursor,
   } satisfies InvitesPage);
};

const acceptInvite = async (
   req: Request,
   res: Response,
   input: InviteIdInput
) => {
   const user = requireUser(req);
   const { inviteId } = input;
   const { server, role, grants, audit } = await prisma.$transaction(
      async (tx) => {
         const addressed = await tx.pendingInvitation.findUnique({
            where: { id: inviteId },
            select: { serverId: true, email: true },
         });
         if (!addressed || !sameEmail(addressed.email, user.email))
            throw new ApiHttpError(404, NOT_FOUND);
         await lockBucketScope(tx, addressed.serverId);
         const invite = await tx.pendingInvitation.findUnique({
            where: { id: inviteId },
            select: {
               email: true,
               role: true,
               expiresAt: true,
               serverId: true,
               invitedById: true,
               server: { select: serverInfoSelect },
               bucketAccess: { select: bucketGrantSelect },
            },
         });
         if (
            !invite ||
            !sameEmail(invite.email, user.email) ||
            invite.expiresAt <= new Date() ||
            !(await senderCanStillGrant(tx, invite))
         ) {
            throw new ApiHttpError(404, NOT_FOUND);
         }
         const { count } = await tx.pendingInvitation.deleteMany({
            where: { id: inviteId },
         });
         if (count === 0) throw new ApiHttpError(404, NOT_FOUND);
         const role = await grantServerRole(
            tx,
            user.id,
            invite.serverId,
            Role[invite.role]
         );
         // audit what was stored: a partly overlapping invite may add less than it offered.
         const grants = await grantBucketRoles(
            tx,
            user.id,
            invite.serverId,
            invite.bucketAccess
         );
         if (role === Role.ADMIN) {
            assertNotLimited(
               await loadBucketGrants(user.id, invite.serverId, tx),
               (bucketName) =>
                  `This invite makes you an admin, but your access to ${bucketName} is limited to folders. Ask the server owner to update your access first.`
            );
         }
         return {
            server: toServerInfo(invite.server, role),
            role,
            grants,
            audit: auditScopeOf(invite.server),
         };
      }
   );
   await recordFor(user, server.id, audit, {
      action: "invite.accept",
      detail: { role, ...bucketDetail(grants) },
   });
   res.json({ server });
};

const rejectInvite = async (
   req: Request,
   res: Response,
   input: InviteIdInput
) => {
   const user = requireUser(req);
   const { inviteId } = input;
   const invite = await prisma.pendingInvitation.findUnique({
      where: { id: inviteId },
      select: { serverId: true, server: { select: auditScopeSelect } },
   });
   const { count } = await prisma.pendingInvitation.deleteMany({
      where: { id: inviteId, email: normalizeEmail(user.email) },
   });
   if (count === 0) throw new ApiHttpError(404, NOT_FOUND);
   if (invite) {
      await recordFor(user, invite.serverId, auditScopeOf(invite.server), {
         action: "invite.reject",
      });
   }
   noContent(res);
};

invitesRouter.get("/", ...validatedRoute(pageSchema, listReceived));
invitesRouter.get("/sent", ...validatedRoute(pageSchema, listSent));
invitesRouter.post(
   "/:inviteId/accept",
   ...validatedRoute(inviteIdSchema, acceptInvite)
);
invitesRouter.post(
   "/:inviteId/reject",
   ...validatedRoute(inviteIdSchema, rejectInvite)
);

export { invitesRouter };
