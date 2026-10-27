import { memberNotFound } from "@/lib/http";
import {
   FORBIDDEN,
   denied,
   type DenialReason,
   type DenialScope,
} from "@/lib/middleware/access-denied";
import {
   Permission,
   canManageRole,
   canRemoveAccess,
   hasPermission,
} from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/shared";
import type { GrantRefusal } from "./grant-rules";

const grantRefusal =
   (scope: DenialScope): GrantRefusal =>
   (message, bucket) =>
      denied(403, message, scope, Permission.MANAGE_MEMBERS, "member", bucket);

type MemberAuthority = {
   serverRole: Role | null;
   targetRole: Role | null;
   newRole?: Role | undefined;
   targetBucketRoles?: readonly Role[];
};

const assertMemberAuthority = (
   scope: DenialScope,
   { serverRole, targetRole, newRole, targetBucketRoles }: MemberAuthority
): { serverRole: Role; targetRole: Role } => {
   const refused = (message: string, reason: DenialReason) =>
      denied(403, message, scope, Permission.MANAGE_MEMBERS, reason);
   if (!serverRole || !hasPermission(serverRole, Permission.MANAGE_MEMBERS)) {
      throw refused(FORBIDDEN, "forbidden");
   }
   if (!targetRole) throw memberNotFound();
   if (!canManageRole(serverRole, targetRole)) {
      throw refused("You can't manage that member", "member");
   }
   if (newRole && !canManageRole(serverRole, newRole)) {
      throw refused("You can't assign that role", "member");
   }
   if (
      targetBucketRoles &&
      !canRemoveAccess(serverRole, targetRole, targetBucketRoles)
   ) {
      throw refused(
         "You can't remove a member with protected bucket access",
         "member"
      );
   }
   return { serverRole, targetRole };
};

export { assertMemberAuthority, grantRefusal };
