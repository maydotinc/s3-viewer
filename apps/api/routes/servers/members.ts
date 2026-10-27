import { noContent } from "@/lib/http";
import { denialScopeOf, getAuth } from "@/lib/middleware/authorize";
import { requireFreshSession } from "@/lib/middleware/fresh-session";
import { memberRoute } from "@/lib/middleware/route";
import { recordMany } from "@/lib/middleware/audit-record";
import {
   assertMemberAuthority,
   grantRefusal,
} from "@/lib/services/member-authority";
import { changeMemberRole } from "@/lib/services/member-role";
import { listMembers, removeMembership } from "@/lib/services/members";
import {
   pageSchema,
   removeMemberSchema,
   serverScope,
   updateRoleSchema,
   type RemoveMemberInput,
   type UpdateRoleInput,
} from "@s3-viewer/shared";
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
   const { userId, serverRole } = getAuth(res);
   res.json(
      await listMembers(serverId, cursor, limit, {
         id: userId,
         role: serverRole,
      })
   );
};

const updateRole = async (
   req: Request,
   res: Response,
   input: UpdateRoleInput
) => {
   const { member, entries } = await changeMemberRole(input, {
      actorId: getAuth(res).userId,
      denial: denialScopeOf(res),
      requireFresh: (action) => requireFreshSession(req, action),
   });
   await recordMany(res, entries);
   res.json({ member });
};

const removeMember = async (
   _req: Request,
   res: Response,
   input: RemoveMemberInput
) => {
   const { serverId, userId } = input;
   const { userId: actorId } = getAuth(res);
   const scope = denialScopeOf(res);
   const { email, revokedInvites } = await removeMembership(userId, serverId, {
      id: actorId,
      assertAuthority: (roles) => assertMemberAuthority(scope, roles),
      refuse: grantRefusal(scope),
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
