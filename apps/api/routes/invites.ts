import { ApiHttpError, asyncHandler, noContent } from "@/lib/http";
import { requireVerifiedUser } from "@/lib/middleware/authorize";
import { validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import {
   addressedTo,
   grantBucketRoles,
   grantServerRole,
   inviteSelect,
   toServerInvite,
} from "@/lib/services/invites";
import { bucketGrantSelect } from "@/lib/services/members";
import { serverInfoSelect, toServerInfo } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { Role, inviteIdSchema, type InviteIdInput } from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const invitesRouter: Router = Router();

const NOT_FOUND = "Invite not found or expired";

const sameEmail = (a: string, b: string): boolean =>
   a.toLowerCase() === b.toLowerCase();

const listReceived = async (req: Request, res: Response) => {
   const user = requireVerifiedUser(req);
   const rows = await prisma.pendingInvitation.findMany({
      where: { email: addressedTo(user.email), expiresAt: { gt: new Date() } },
      select: inviteSelect,
      orderBy: { createdAt: "desc" },
   });
   res.json({ invites: rows.map(toServerInvite) });
};

const acceptInvite = async (req: Request, res: Response) => {
   const user = requireVerifiedUser(req);
   const { inviteId } = input<InviteIdInput>(res);
   const server = await prisma.$transaction(async (tx) => {
      const invite = await tx.pendingInvitation.findUnique({
         where: { id: inviteId },
         select: {
            email: true,
            role: true,
            expiresAt: true,
            serverId: true,
            server: { select: serverInfoSelect },
            bucketAccess: { select: bucketGrantSelect },
         },
      });
      if (
         !invite ||
         !sameEmail(invite.email, user.email) ||
         invite.expiresAt <= new Date()
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
      await grantBucketRoles(tx, user.id, invite.serverId, invite.bucketAccess);
      return toServerInfo(invite.server, role);
   });
   res.json({ server });
};

const rejectInvite = async (req: Request, res: Response) => {
   const user = requireVerifiedUser(req);
   const { inviteId } = input<InviteIdInput>(res);
   const { count } = await prisma.pendingInvitation.deleteMany({
      where: { id: inviteId, email: addressedTo(user.email) },
   });
   if (count === 0) throw new ApiHttpError(404, NOT_FOUND);
   noContent(res);
};

invitesRouter.get("/", asyncHandler(listReceived));
invitesRouter.post(
   "/:inviteId/accept",
   ...validatedRoute(inviteIdSchema, acceptInvite)
);
invitesRouter.post(
   "/:inviteId/reject",
   ...validatedRoute(inviteIdSchema, rejectInvite)
);

export { invitesRouter };
