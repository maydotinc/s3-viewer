import { MEMBER_NOT_FOUND } from "@/lib/constants";
import { decodeCursor, keysetAfter, pageOf, type Position } from "@/lib/cursor";
import { ApiHttpError } from "@/lib/http";
import {
   bucketGrantSelect,
   bucketGrantsLateral,
   canRemoveGrant,
   findUnremovableGrant,
   folderColumns,
   grantFoldersOf,
   toBucketEntry,
   toScopedGrant,
   withVisibleGrants,
   type BucketRow,
   type VisibleBuckets,
} from "./bucket-grants";
import { revokeInvalidInvites } from "./invite-authority";
import {
   isBucketAllowed,
   lockBucketScope,
   type BucketScopeSettings,
} from "./servers";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@s3-viewer/db";
import {
   ROLE_LABELS,
   canGrantBucketAccess,
   canGrantBucketRole,
   canManageRole,
   rolesAbove,
} from "@s3-viewer/permissions";
import {
   ErrorCode,
   MAX_BUCKET_NAMES,
   Role,
   canLimitToFolders,
   sameFolderScope,
   type AuditDetail,
   type AuditEntry,
   type MemberPage,
   type ScopedGrant,
   type ServerUser,
   type UpdateRoleInput,
} from "@s3-viewer/types";

type BucketGrant = NonNullable<UpdateRoleInput["bucketAccess"]>[number];

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

const memberSelect = (serverId: string) =>
   ({
      id: true,
      createdAt: true,
      role: true,
      user: {
         select: {
            id: true,
            name: true,
            email: true,
            bucketAccess: {
               where: { serverId },
               select: bucketGrantSelect,
               orderBy: { bucketName: "asc" },
            },
         },
      },
   }) satisfies Prisma.ServerAccessSelect;

type MemberRow = Prisma.ServerAccessGetPayload<{
   select: ReturnType<typeof memberSelect>;
}>;

const toServerUser = (row: MemberRow): ServerUser => ({
   id: row.user.id,
   name: row.user.name,
   email: row.user.email,
   role: Role[row.role],
   bucketAccess: row.user.bucketAccess.map(toBucketEntry),
});

const memberPage = (
   serverId: string,
   position: Position | undefined,
   take: number
): Promise<MemberRow[]> =>
   prisma.$queryRaw<MemberRow[]>`
      WITH page AS (
         SELECT "id", "createdAt", "role", "userId", "serverId"
         FROM "server_access"
         WHERE "serverId" = ${serverId} ${
            position
               ? Prisma.sql`AND ${keysetAfter(position, "asc")}`
               : Prisma.empty
         }
         ORDER BY "createdAt" ASC, "id" ASC
         LIMIT ${take}
      )
      SELECT page."id", page."createdAt", page."role",
         jsonb_build_object(
            'id', u."id", 'name', u."name", 'email', u."email",
            'bucketAccess', COALESCE(grants.buckets, '[]'::jsonb)
         ) AS "user"
      FROM page
      JOIN "user" u ON u."id" = page."userId"
      ${bucketGrantsLateral(
         "bucket_access",
         Prisma.sql`b."userId" = page."userId" AND b."serverId" = page."serverId"`
      )}
      ORDER BY page."createdAt" ASC, page."id" ASC`;

type Actor = { id: string; role: Role };

const listMembers = async (
   serverId: string,
   cursor: string | undefined,
   limit: number,
   viewer: Actor
): Promise<MemberPage> => {
   const position = cursor ? decodeCursor(cursor) : undefined;
   const [rows, visible] = await Promise.all([
      memberPage(serverId, position, limit + 1),
      visibleBuckets(viewer.id, serverId, viewer.role),
   ]);
   const { page, nextCursor } = pageOf(rows, limit);
   return {
      members: page.map((row) => withVisibleGrants(visible, toServerUser(row))),
      nextCursor,
   };
};

const findMember = async (
   serverId: string,
   userId: string,
   db: Prisma.TransactionClient = prisma
): Promise<ServerUser | null> => {
   const row = await db.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: memberSelect(serverId),
   });
   return row ? toServerUser(row) : null;
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
   return row ? Role[row.role] : null;
};

type GrantingActor = {
   serverRole: Role;
   bucketGrants: ReadonlyMap<string, ScopedGrant>;
};

type GrantRefusal = (
   message: string,
   reason: "member" | "folder",
   bucket: string | null,
   code?: ErrorCode
) => Error;

// only a bucket the actor holds is named in the audit row; any other name is whatever the caller typed.
const heldBucket = (
   bucketGrants: ReadonlyMap<string, ScopedGrant>,
   bucketName: string
): string | null => (bucketGrants.has(bucketName) ? bucketName : null);

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

// a bucket-limited admin would otherwise learn the names and folders of buckets it can't open.
const visibleBuckets = async (
   viewerId: string,
   serverId: string,
   serverRole: Role,
   db: Prisma.TransactionClient = prisma
): Promise<VisibleBuckets> =>
   serverRole === Role.OWNER
      ? null
      : heldBucketNames(await loadBucketGrants(viewerId, serverId, db));

const grantsByBucket = (
   rows: readonly BucketRow[]
): ReadonlyMap<string, ScopedGrant> =>
   new Map(rows.map((row) => [row.bucketName, toScopedGrant(row)]));

const holdsExactly = (
   held: ReadonlyMap<string, ScopedGrant>,
   { bucketName, role, folders }: BucketGrant
): boolean => {
   const grant = held.get(bucketName);
   return (
      grant !== undefined &&
      grant.role === Role[role] &&
      sameFolderScope(grant.folders, folders)
   );
};

const assertUniqueBuckets = (grants: readonly BucketGrant[]): void => {
   const seen = new Set<string>();
   for (const { bucketName } of grants) {
      if (seen.has(bucketName)) {
         throw new ApiHttpError(
            400,
            `Duplicate bucket: ${bucketName}`,
            ErrorCode.VALIDATION
         );
      }
      seen.add(bucketName);
   }
};

const assertBucketInScope = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   bucketName: string
): void => {
   // an admin with no grant on the bucket hits the same 403 in assertBucketGrants whether or not it is listed.
   if (actor.serverRole !== Role.OWNER && !actor.bucketGrants.has(bucketName)) {
      return;
   }
   if (!isBucketAllowed(scope, bucketName)) {
      throw new ApiHttpError(
         400,
         `Unknown bucket: ${bucketName}`,
         ErrorCode.VALIDATION
      );
   }
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
      if (folders !== null && !canLimitToFolders(Role[role])) {
         throw new ApiHttpError(
            400,
            `${ROLE_LABELS[Role[role]]} access to ${bucketName} can't be limited to folders`,
            ErrorCode.VALIDATION
         );
      }
      if (!canManageRole(actor.serverRole, Role[role])) {
         throw refuse(
            `You can't grant ${ROLE_LABELS[Role[role]]} on ${bucketName}`,
            "member",
            audited
         );
      }
      const held = actor.bucketGrants.get(bucketName);
      if (!canGrantBucketRole(actor.serverRole, held?.role, Role[role])) {
         throw refuse(
            `You don't have ${ROLE_LABELS[Role[role]]} access to ${bucketName}, so you can't grant it`,
            "member",
            audited
         );
      }
      if (
         !canGrantBucketAccess(actor.serverRole, held, {
            role: Role[role],
            folders,
         })
      ) {
         throw refuse(
            `Your access to ${bucketName} is limited to folders, so you can only grant access inside them`,
            "folder",
            audited,
            ErrorCode.FOLDER_ACCESS
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
         `You can't change ${ROLE_LABELS[Role[unremovable.role]]} access to ${unremovable.bucketName}`,
         "member",
         heldBucket(actor.bucketGrants, unremovable.bucketName)
      );
   }
};

const sameGrants = (
   current: readonly BucketRow[],
   grants: readonly BucketGrant[]
): boolean => {
   const held = grantsByBucket(current);
   return (
      held.size === grants.length &&
      new Set(grants.map(({ bucketName }) => bucketName)).size === held.size &&
      grants.every((grant) => holdsExactly(held, grant))
   );
};

const assertAccessAsShown = (
   current: readonly BucketRow[],
   shown: readonly BucketGrant[],
   requested: readonly BucketGrant[]
): void => {
   if (!sameGrants(current, shown) && !sameGrants(current, requested)) {
      throw new ApiHttpError(
         409,
         "This member's access changed while you were editing it. Reopen it and try again."
      );
   }
};

// grants the editor never saw survive the save, so capping the submitted list alone would let the
// total outgrow what an owner's editor can send back as the access it was shown.
const assertBucketCount = (
   kept: number,
   grants: readonly BucketGrant[]
): void => {
   if (kept + grants.length > MAX_BUCKET_NAMES) {
      throw new ApiHttpError(
         400,
         `A member can have access to at most ${MAX_BUCKET_NAMES} buckets`,
         ErrorCode.VALIDATION
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
         "member",
         null
      );
   }
   throw refuse(
      `You can't remove a member with ${ROLE_LABELS[Role[unremovable.role]]} access to ${unremovable.bucketName}`,
      "member",
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
      const targetRole = target ? Role[target.role] : null;
      if (actor) {
         const actorRole = await memberRole(tx, actor.id, serverId);
         const targetGrants = await loadBucketGrants(userId, serverId, tx);
         actor.assertAuthority({
            serverRole: actorRole,
            targetRole,
            targetBucketRoles: targetGrants.map((grant) => Role[grant.role]),
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
      if (!target) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
      await tx.bucketAccess.deleteMany({ where: { userId, serverId } });
      const removed = await tx.serverAccess.deleteMany({
         where: { userId, serverId },
      });
      if (removed.count === 0) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
      const revokedInvites = await revokeInvalidInvites(tx, serverId);
      return { email: target.user.email, revokedInvites };
   });

export {
   assertAccessAsShown,
   assertBucketCount,
   assertBucketGrantChanges,
   assertBucketGrants,
   assertNotLimited,
   bucketDetail,
   clampBucketAccess,
   findMember,
   grantsByBucket,
   heldBucketNames,
   listMembers,
   loadBucketGrants,
   loadGrantingActor,
   memberRole,
   removeMembership,
   replaceBucketAccess,
   visibleBuckets,
};
export type { GrantRefusal, GrantingActor };
