import { decodeCursor, pageOf } from "@/lib/cursor";
import { ApiHttpError, memberNotFound } from "@/lib/http";
import {
   bucketGrantSelect,
   canRemoveGrant,
   findUnremovableGrant,
   folderColumns,
   grantFoldersOf,
   toScopedGrant,
   withVisibleGrants,
   type BucketRow,
   type VisibleBuckets,
} from "./bucket-grants";
import {
   assertBucketInScope,
   assertUniqueBuckets,
   grantsByBucket,
   heldBucket,
   holdsExactly,
   type BucketGrant,
   type GrantRefusal,
   type GrantingActor,
} from "./grant-rules";
import { revokeInvalidInvites } from "./invite-authority";
import {
   memberPage,
   memberSelect,
   toServerUser,
   type Actor,
   type Viewer,
} from "./member-rows";
import { lockBucketScope, type BucketScopeSettings } from "./servers";
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@s3-viewer/db";
import {
   ROLE_LABELS,
   canGrantBucketAccess,
   canManageRole,
   rolesAbove,
} from "@s3-viewer/permissions";
import {
   ErrorCode,
   Role,
   canLimitToFolders,
   type AuditDetail,
   type AuditEntry,
   type MemberPage,
   type ScopedGrant,
   type ServerUser,
} from "@s3-viewer/shared";

const MAX_DETAIL_CHARS = 1024;

type DetailGrant = {
   bucketName: string;
   role: string;
   folders: readonly string[] | null;
};

const namedFolders = ({ bucketName, role, folders }: DetailGrant): string =>
   `${bucketName}:${role}${folders === null ? "" : JSON.stringify(folders)}`;

const digestedFolders = ({
   bucketName,
   role,
   folders,
}: DetailGrant): string => {
   if (folders === null) return `${bucketName}:${role}`;
   const digest = createHash("sha256")
      .update(JSON.stringify(folders))
      .digest("hex");
   return `${bucketName}:${role}[${folders.length} folders sha256:${digest.slice(0, 16)}]`;
};

const bucketDetail = (grants: readonly DetailGrant[]): AuditDetail => {
   if (grants.length === 0) return {};
   const sorted = [...grants].sort((a, b) =>
      a.bucketName.localeCompare(b.bucketName)
   );
   const named = sorted.map(namedFolders).join(",");
   return {
      buckets:
         named.length <= MAX_DETAIL_CHARS
            ? named
            : sorted.map(digestedFolders).join(","),
   };
};

const listMembers = async (
   serverId: string,
   cursor: string | undefined,
   limit: number,
   viewer: Actor
): Promise<MemberPage> => {
   const position = cursor ? decodeCursor(cursor) : undefined;
   const [rows, { visible, held }] = await Promise.all([
      memberPage(serverId, position, limit + 1),
      viewerGrants(viewer.id, serverId, viewer.role),
   ]);
   const { page, nextCursor } = pageOf(rows, limit);
   return {
      members: page.map((row) =>
         withVisibleGrants(visible, toServerUser(row, { ...viewer, held }))
      ),
      nextCursor,
   };
};

const findMember = async (
   serverId: string,
   userId: string,
   viewer: Viewer,
   db: Prisma.TransactionClient = prisma
): Promise<ServerUser | null> => {
   const row = await db.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: memberSelect(serverId),
   });
   return row ? toServerUser(row, viewer) : null;
};

const memberRole = async (
   db: Prisma.TransactionClient,
   userId: string,
   serverId: string
): Promise<Role | null> => {
   const row = await db.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: { role: true },
   });
   return row?.role ?? null;
};

const loadGrantingActor = async (
   userId: string,
   serverId: string,
   serverRole: Role,
   grants: readonly Pick<BucketGrant, "bucketName">[],
   db: Prisma.TransactionClient = prisma
): Promise<GrantingActor> => {
   const bucketNames = grants.map((g) => g.bucketName);
   if (serverRole === Role.OWNER || bucketNames.length === 0) {
      return { serverRole, bucketGrants: new Map() };
   }
   const rows = await db.bucketAccess.findMany({
      where: { userId, serverId, bucketName: { in: bucketNames } },
      select: bucketGrantSelect,
   });
   return {
      serverRole,
      bucketGrants: new Map(rows.map((r) => [r.bucketName, toScopedGrant(r)])),
   };
};

const loadBucketGrants = (
   userId: string,
   serverId: string,
   db: Prisma.TransactionClient = prisma
): Promise<BucketRow[]> =>
   db.bucketAccess.findMany({
      where: { userId, serverId },
      select: bucketGrantSelect,
      orderBy: { bucketName: "asc" },
   });

const heldBucketNames = (held: readonly BucketRow[]): Set<string> =>
   new Set(held.map((row) => row.bucketName));

type ViewerGrants = {
   visible: VisibleBuckets;
   held: ReadonlyMap<string, ScopedGrant>;
};

// a bucket-limited admin would otherwise learn the names and folders of buckets it can't open.
const viewerGrants = async (
   viewerId: string,
   serverId: string,
   serverRole: Role,
   db: Prisma.TransactionClient = prisma
): Promise<ViewerGrants> => {
   if (serverRole === Role.OWNER) return { visible: null, held: new Map() };
   const rows = await loadBucketGrants(viewerId, serverId, db);
   return { visible: heldBucketNames(rows), held: grantsByBucket(rows) };
};

const assertBucketGrants = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   grants: readonly BucketGrant[],
   refuse: GrantRefusal
): void => {
   assertUniqueBuckets(grants);
   for (const { bucketName, role, folders } of grants) {
      assertBucketInScope(actor, scope, bucketName);
      const audited = heldBucket(actor.bucketGrants, bucketName);
      if (folders !== null && !canLimitToFolders(role)) {
         throw new ApiHttpError(
            400,
            `${ROLE_LABELS[role]} access to ${bucketName} can't be limited to folders`,
            ErrorCode.VALIDATION
         );
      }
      if (!canManageRole(actor.serverRole, role)) {
         throw refuse(
            `You can't grant ${ROLE_LABELS[role]} on ${bucketName}`,
            audited
         );
      }
      const held = actor.bucketGrants.get(bucketName);
      if (
         !canGrantBucketAccess(actor.serverRole, held, {
            role,
            folders,
         })
      ) {
         throw refuse(
            `You don't have ${ROLE_LABELS[role]} access to ${bucketName}, so you can't grant it`,
            audited
         );
      }
   }
};

const assertBucketGrantChanges = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   current: readonly BucketRow[],
   grants: readonly BucketGrant[],
   refuse: GrantRefusal
): void => {
   assertUniqueBuckets(grants);
   const held = grantsByBucket(current);
   const unchanged = (grant: BucketGrant): boolean => holdsExactly(held, grant);
   for (const { bucketName } of grants) {
      assertBucketInScope(actor, scope, bucketName);
   }
   assertBucketGrants(
      actor,
      scope,
      grants.filter((grant) => !unchanged(grant)),
      refuse
   );
   const kept = new Set(grants.filter(unchanged).map((g) => g.bucketName));
   const dropped = current.filter((row) => !kept.has(row.bucketName));
   const unremovable = findUnremovableGrant(
      actor.serverRole,
      actor.bucketGrants,
      dropped
   );
   if (unremovable) {
      throw refuse(
         `You can't change ${ROLE_LABELS[unremovable.role]} access to ${unremovable.bucketName}`,
         heldBucket(actor.bucketGrants, unremovable.bucketName)
      );
   }
};

const assertNotLimited = (
   grants: readonly BucketRow[],
   message: (bucketName: string) => string
): void => {
   const limited = grants.find((row) => grantFoldersOf(row) !== null);
   if (limited) throw new ApiHttpError(409, message(limited.bucketName));
};

// only grants the actor could hand out are clamped; the rest may exceed the new role, like grants above the actor's rank.
const clampBucketAccess = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   role: Role,
   actor: Actor
): Promise<void> => {
   const above = rolesAbove(role).filter((r) => canManageRole(actor.role, r));
   if (above.length === 0) return;
   const where = { userId, serverId, role: { in: above } };
   if (actor.role === Role.OWNER) {
      await tx.bucketAccess.updateMany({ where, data: { role } });
      return;
   }
   const rows = await tx.bucketAccess.findMany({
      where,
      select: bucketGrantSelect,
   });
   const { bucketGrants } = await loadGrantingActor(
      actor.id,
      serverId,
      actor.role,
      rows,
      tx
   );
   const clamped = rows
      .filter((row) => canRemoveGrant(actor.role, bucketGrants, row))
      .map((row) => row.bucketName);
   if (clamped.length === 0) return;
   await tx.bucketAccess.updateMany({
      where: { ...where, bucketName: { in: clamped } },
      data: { role },
   });
};

// grants the editor never saw are kept, since the submitted list only ever covers visible buckets.
const replaceBucketAccess = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   grants: readonly BucketGrant[],
   visible: VisibleBuckets
): Promise<void> => {
   await tx.bucketAccess.deleteMany({
      where: {
         userId,
         serverId,
         ...(visible !== null && { bucketName: { in: [...visible] } }),
      },
   });
   if (grants.length === 0) return;
   await tx.bucketAccess.createMany({
      data: grants.map(({ bucketName, role, folders }) => ({
         userId,
         serverId,
         bucketName,
         role,
         ...folderColumns(folders),
      })),
   });
};

type MemberAuthorityCheck = (roles: {
   serverRole: Role | null;
   targetRole: Role | null;
   targetBucketRoles: readonly Role[];
}) => void;

const assertGrantsRemovable = async (
   tx: Prisma.TransactionClient,
   actorId: string,
   serverId: string,
   serverRole: Role | null,
   grants: readonly BucketRow[],
   refuse: GrantRefusal
): Promise<void> => {
   if (serverRole === null || grants.length === 0) return;
   const { bucketGrants } = await loadGrantingActor(
      actorId,
      serverId,
      serverRole,
      grants,
      tx
   );
   const unremovable = findUnremovableGrant(serverRole, bucketGrants, grants);
   if (!unremovable) return;
   // naming a bucket the actor holds nothing on would reveal it.
   if (serverRole !== Role.OWNER && !bucketGrants.has(unremovable.bucketName)) {
      throw refuse(
         "You can't remove a member with access to buckets you don't hold",
         null
      );
   }
   throw refuse(
      `You can't remove a member with ${ROLE_LABELS[unremovable.role]} access to ${unremovable.bucketName}`,
      heldBucket(bucketGrants, unremovable.bucketName)
   );
};

const removeMembership = (
   userId: string,
   serverId: string,
   actor?: {
      id: string;
      assertAuthority: MemberAuthorityCheck;
      refuse: GrantRefusal;
   }
): Promise<{ email: string; revokedInvites: AuditEntry[] }> =>
   prisma.$transaction(async (tx) => {
      await lockBucketScope(tx, serverId);
      const target = await tx.serverAccess.findUnique({
         where: { userId_serverId: { userId, serverId } },
         select: { role: true, user: { select: { email: true } } },
      });
      const targetRole = target?.role ?? null;
      if (actor) {
         const actorRole = await memberRole(tx, actor.id, serverId);
         const targetGrants = await loadBucketGrants(userId, serverId, tx);
         actor.assertAuthority({
            serverRole: actorRole,
            targetRole,
            targetBucketRoles: targetGrants.map((grant) => grant.role),
         });
         await assertGrantsRemovable(
            tx,
            actor.id,
            serverId,
            actorRole,
            targetGrants,
            actor.refuse
         );
      } else if (targetRole === Role.OWNER) {
         throw new ApiHttpError(403, "Owners can't leave their server");
      }
      if (!target) throw memberNotFound();
      const removed = await tx.serverAccess.deleteMany({
         where: { userId, serverId },
      });
      if (removed.count === 0) throw memberNotFound();
      const revokedInvites = await revokeInvalidInvites(tx, serverId);
      return { email: target.user.email, revokedInvites };
   });

export {
   assertBucketGrantChanges,
   assertBucketGrants,
   assertNotLimited,
   bucketDetail,
   clampBucketAccess,
   findMember,
   listMembers,
   loadBucketGrants,
   loadGrantingActor,
   memberRole,
   removeMembership,
   replaceBucketAccess,
   viewerGrants,
};
