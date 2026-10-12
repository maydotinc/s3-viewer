import { MEMBER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, noContent, rethrowDbError } from "@/lib/http";
import { assertMemberAuthority, getAuth } from "@/lib/middleware/authorize";
import { memberRoute } from "@/lib/middleware/route";
import { recordMany } from "@/lib/middleware/audit-record";
import { revokeInvalidInvites } from "@/lib/services/invite-authority";
import {
   assertAccessAsShown,
   assertBucketGrantChanges,
   assertNotLimited,
   clampBucketAccess,
   bucketDetail,
   findMember,
   listMembers,
   loadBucketGrants,
   loadGrantingActor,
   memberRole,
   removeMembership,
   replaceBucketAccess,
} from "@/lib/services/members";
import { lockBucketScope } from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { rankOf } from "@s3-viewer/permissions";
import {
   Role,
   pageSchema,
   removeMemberSchema,
   serverScope,
   updateRoleSchema,
   type AuditEntry,
   type RemoveMemberInput,
   type UpdateRoleInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";
import type { z } from "zod";

const membersRouter: Router = Router();

const memberListSchema = serverScope.merge(pageSchema);
type MemberListInput = z.infer<typeof memberListSchema>;

const getMembers = async (
   _req: Request,
   res: Response,
   input: MemberListInput
) => {
   const { serverId, cursor, limit } = input;
   res.json(await listMembers(serverId, cursor, limit));
};

const updateRole = async (
   _req: Request,
   res: Response,
   input: UpdateRoleInput
) => {
   const { serverId, userId, role, bucketAccess, previousBucketAccess } = input;
   const { userId: actorId } = getAuth(res);
   const newRole = Role[role];
   const { member, revokedInvites } = await prisma.$transaction(async (tx) => {
      const scope = await lockBucketScope(tx, serverId);
      const [actorRole, currentRole] = await Promise.all([
         memberRole(tx, actorId, serverId),
         memberRole(tx, userId, serverId),
      ]);
      const { serverRole, targetRole } = assertMemberAuthority(res, {
         serverRole: actorRole,
         targetRole: currentRole,
         newRole,
      });
      const demoted = rankOf(newRole) < rankOf(targetRole);
      if (bucketAccess) {
         const current = await loadBucketGrants(userId, serverId, tx);
         // the actor's holdings are also needed on buckets the edit drops, since removing a grant takes the same authority as giving it.
         const actor = await loadGrantingActor(
            actorId,
            serverId,
            serverRole,
            [...bucketAccess, ...current],
            tx
         );
         assertAccessAsShown(current, previousBucketAccess ?? [], bucketAccess);
         assertBucketGrantChanges(actor, scope, current, bucketAccess);
      } else if (newRole === Role.ADMIN) {
         assertNotLimited(
            await loadBucketGrants(userId, serverId, tx),
            (bucketName) =>
               `Their access to ${bucketName} is limited to folders. Give them the whole bucket before making them an admin.`
         );
      }
      await tx.serverAccess
         .update({
            where: { userId_serverId: { userId, serverId } },
            data: { role },
         })
         .catch((err: unknown) =>
            rethrowDbError(err, {
               missing: new ApiHttpError(404, MEMBER_NOT_FOUND),
            })
         );
      if (bucketAccess)
         await replaceBucketAccess(tx, userId, serverId, bucketAccess);
      // bucket grants may exceed the server role; clamp them only on demotion.
      if (demoted)
         await clampBucketAccess(tx, userId, serverId, newRole, serverRole);
      // read back inside the transaction so a concurrent removal rolls the change back instead of answering 404 after it committed.
      const member = await findMember(serverId, userId, tx);
      if (!member) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
      return {
         member,
         revokedInvites: await revokeInvalidInvites(tx, serverId),
      };
   });
   const changed: AuditEntry = {
      action: "member.role_change",
      target: member.email,
      detail: { role, userId, ...bucketDetail(member.bucketAccess) },
   };
   await recordMany(res, [changed, ...revokedInvites]);
   res.json({ member });
};

const removeMember = async (
   _req: Request,
   res: Response,
   input: RemoveMemberInput
) => {
   const { serverId, userId } = input;
   const { userId: actorId } = getAuth(res);
   const { email, revokedInvites } = await removeMembership(userId, serverId, {
      id: actorId,
      assertAuthority: (roles) => assertMemberAuthority(res, roles),
   });
   await recordMany(res, [
      { action: "member.remove", target: email, detail: { userId } },
      ...revokedInvites,
   ]);
   noContent(res);
};

membersRouter.get(
   "/:serverId/members",
   ...memberRoute(memberListSchema, getMembers)
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
