import { MEMBER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, noContent } from "@/lib/http";
import { getAuth } from "@/lib/middleware/authorize";
import { memberRoute, serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import {
   assertBucketGrants,
   findMember,
   listMembers,
   removeMembership,
   replaceBucketAccess,
} from "@/lib/services/members";
import { loadServerSettings } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import {
   removeMemberSchema,
   serverScope,
   updateRoleSchema,
   type RemoveMemberInput,
   type ServerScope,
   type UpdateRoleInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const membersRouter: Router = Router();

const getMembers = async (_req: Request, res: Response) => {
   const { serverId } = input<ServerScope>(res);
   res.json({ members: await listMembers(serverId) });
};

const updateRole = async (_req: Request, res: Response) => {
   const { serverId, userId, role, bucketAccess } = input<UpdateRoleInput>(res);
   const { serverRole } = getAuth(res);
   if (bucketAccess) {
      const { allowedBuckets } = await loadServerSettings(serverId);
      assertBucketGrants(serverRole, allowedBuckets, bucketAccess);
   }
   await prisma.$transaction(async (tx) => {
      await tx.serverAccess.update({
         where: { userId_serverId: { userId, serverId } },
         data: { role },
      });
      if (bucketAccess)
         await replaceBucketAccess(tx, userId, serverId, bucketAccess);
   });
   const member = await findMember(serverId, userId);
   if (!member) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
   res.json({ member });
};

const removeMember = async (_req: Request, res: Response) => {
   const { serverId, userId } = input<RemoveMemberInput>(res);
   await removeMembership(userId, serverId);
   noContent(res);
};

membersRouter.get(
   "/:serverId/members",
   ...serverRoute(Permission.MANAGE_MEMBERS, serverScope, getMembers)
);
membersRouter.patch(
   "/:serverId/members/:userId",
   ...memberRoute(updateRoleSchema, updateRole)
);
membersRouter.delete(
   "/:serverId/members/:userId",
   ...memberRoute(removeMemberSchema, removeMember)
);

export { membersRouter };
