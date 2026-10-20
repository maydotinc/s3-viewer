import { ApiHttpError, noContent } from "@/lib/http";
import { getAuth, lockedPermission, refuse } from "@/lib/middleware/authorize";
import { memberRoute } from "@/lib/middleware/route";
import { record } from "@/lib/middleware/audit-record";
import { serverInvitePage, toServerInvite } from "@/lib/services/invites";
import { withVisibleGrants } from "@/lib/services/bucket-grants";
import {
   canRevokeInvite,
   revocableInviteSelect,
} from "@/lib/services/invite-authority";
import { loadGrantingActor, viewerGrants } from "@/lib/services/members";
import { lockBucketScope } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import {
   revokeInviteSchema,
   serverScope,
   type InvitesResponse,
   type RevokeInviteInput,
   type ServerScope,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const serverInvitesRouter: Router = Router();
const INVITE_NOT_FOUND = "Invite not found";

const getInvites = async (_req: Request, res: Response, input: ServerScope) => {
   const { serverId } = input;
   const { userId, serverRole } = getAuth(res);
   const [rows, { visible, held }] = await Promise.all([
      serverInvitePage(serverId),
      viewerGrants(userId, serverId, serverRole),
   ]);
   const invites = rows.map((row) => ({
      ...withVisibleGrants(visible, toServerInvite(row)),
      canRevoke: canRevokeInvite({ serverRole, bucketGrants: held }, row),
   }));
   res.json({ invites } satisfies InvitesResponse);
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
serverInvitesRouter.delete(
   "/:serverId/invites/:inviteId",
   ...memberRoute(revokeInviteSchema, revokeInvite)
);

export { serverInvitesRouter };
