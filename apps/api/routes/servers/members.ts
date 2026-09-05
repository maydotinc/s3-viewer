import { MEMBER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, noContent } from "@/lib/http";
import { getAuth } from "@/lib/middleware/authorize";
import { memberRoute, serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { recordAudit } from "@/lib/services/audit";
import {
   assertBucketGrantChanges,
   clampBucketAccess,
   findMember,
   listMembers,
   loadBucketGrants,
   loadGrantingActor,
   removeMembership,
   replaceBucketAccess,
} from "@/lib/services/members";
import { isMissingRow, loadServerSettings } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { Permission, rankOf } from "@s3-viewer/permissions";
import {
   Role,
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
   const { userId: actorId, serverRole, targetRole } = getAuth(res);
   if (bucketAccess) {
      const [scope, current, actor] = await Promise.all([
         loadServerSettings(serverId),
         loadBucketGrants(userId, serverId),
         loadGrantingActor(actorId, serverId, serverRole, bucketAccess),
      ]);
      assertBucketGrantChanges(actor, scope, current, bucketAccess);
   }
   const newRole = Role[role];
   // a bucket grant may outrank the server role on purpose (the picker caps
   // by the actor's rank, not the target's); only a demotion pulls them down
   const demoted = rankOf(newRole) < rankOf(targetRole);
   await prisma.$transaction(async (tx) => {
      try {
         await tx.serverAccess.update({
            where: { userId_serverId: { userId, serverId } },
            data: { role },
         });
      } catch (err) {
         if (isMissingRow(err)) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
         throw err;
      }
      if (bucketAccess)
         await replaceBucketAccess(tx, userId, serverId, bucketAccess);
      if (demoted) await clampBucketAccess(tx, userId, serverId, newRole);
   });
   const member = await findMember(serverId, userId);
   if (!member) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
   await recordAudit({
      action: "member.role_change",
      actorId,
      serverId,
      target: userId,
   });
   res.json({ member });
};

const removeMember = async (_req: Request, res: Response) => {
   const { serverId, userId } = input<RemoveMemberInput>(res);
   const { userId: actorId } = getAuth(res);
   await removeMembership(userId, serverId);
   await recordAudit({
      action: "member.remove",
      actorId,
      serverId,
      target: userId,
   });
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
