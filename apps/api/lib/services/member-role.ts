import { memberNotFound, rethrowDbError } from "@/lib/http";
import type { DenialScope } from "@/lib/middleware/access-denied";
import { visibleGrants, withVisibleGrants } from "./bucket-grants";
import { assertAccessAsShown, assertBucketCount } from "./grant-rules";
import { revokeInvalidInvites } from "./invite-authority";
import { assertMemberAuthority, grantRefusal } from "./member-authority";
import {
   assertBucketGrantChanges,
   assertNotLimited,
   bucketDetail,
   clampBucketAccess,
   findMember,
   loadBucketGrants,
   memberRole,
   replaceBucketAccess,
   viewerGrants,
} from "./members";
import { lockBucketScope } from "./servers";
import { prisma } from "@s3-viewer/db";
import { rankOf } from "@s3-viewer/permissions";
import {
   Role,
   type AuditEntry,
   type ServerUser,
   type UpdateRoleInput,
} from "@s3-viewer/shared";

type RoleChangeContext = {
   actorId: string;
   denial: DenialScope;
   // throws when the actor's sign-in is too old for the change; asked only when the change makes an admin.
   requireFresh: (action: string) => void;
};

// the member as the actor may see it, and the audit rows the change owes.
type RoleChange = { member: ServerUser; entries: AuditEntry[] };

const changeMemberRole = async (
   {
      serverId,
      userId,
      role,
      bucketAccess,
      previousBucketAccess,
   }: UpdateRoleInput,
   { actorId, denial, requireFresh }: RoleChangeContext
): Promise<RoleChange> => {
   const newRole = role;
   const { member, visible, revokedInvites } = await prisma.$transaction(
      async (tx) => {
         const scope = await lockBucketScope(tx, serverId);
         const [actorRole, currentRole] = await Promise.all([
            memberRole(tx, actorId, serverId),
            memberRole(tx, userId, serverId),
         ]);
         const { serverRole, targetRole } = assertMemberAuthority(denial, {
            serverRole: actorRole,
            targetRole: currentRole,
            newRole,
         });
         // previousBucketAccess must match the stored grants before anything is written, so an admin
         // grant it already shows is not new; a bucket admin under a lower server role is still delegated authority.
         const shownAdmin = new Set(
            (previousBucketAccess ?? [])
               .filter((grant) => grant.role === Role.ADMIN)
               .map((grant) => grant.bucketName)
         );
         if (
            (newRole === Role.ADMIN && targetRole !== Role.ADMIN) ||
            bucketAccess?.some(
               (grant) =>
                  grant.role === Role.ADMIN && !shownAdmin.has(grant.bucketName)
            )
         )
            requireFresh("making someone an admin");
         const demoted = rankOf(newRole) < rankOf(targetRole);
         const { visible, held: actorHeld } = await viewerGrants(
            actorId,
            serverId,
            serverRole,
            tx
         );
         if (bucketAccess) {
            const held = await loadBucketGrants(userId, serverId, tx);
            // the editor only ever saw grants on buckets the actor holds, so the edit is checked against those alone.
            const current = visibleGrants(visible, held);
            assertAccessAsShown(
               current,
               previousBucketAccess ?? [],
               bucketAccess
            );
            assertBucketGrantChanges(
               { serverRole, bucketGrants: actorHeld },
               scope,
               current,
               bucketAccess,
               grantRefusal(denial)
            );
            assertBucketCount(
               held.length - current.length,
               bucketAccess.length
            );
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
                  missing: memberNotFound(),
               })
            );
         if (bucketAccess)
            await replaceBucketAccess(
               tx,
               userId,
               serverId,
               bucketAccess,
               visible
            );
         // bucket grants may exceed the server role; clamp them only on demotion.
         if (demoted)
            await clampBucketAccess(tx, userId, serverId, newRole, {
               id: actorId,
               role: serverRole,
            });
         // read back inside the transaction so a concurrent removal rolls the change back instead of answering 404 after it committed.
         const member = await findMember(
            serverId,
            userId,
            {
               id: actorId,
               role: serverRole,
               held: actorHeld,
            },
            tx
         );
         if (!member) throw memberNotFound();
         return {
            member,
            visible,
            revokedInvites: await revokeInvalidInvites(tx, serverId),
         };
      }
   );
   const changed: AuditEntry = {
      action: "member.role_change",
      target: member.email,
      detail: { role, userId, ...bucketDetail(member.bucketAccess) },
   };
   return {
      member: withVisibleGrants(visible, member),
      entries: [changed, ...revokedInvites],
   };
};

export { changeMemberRole };
