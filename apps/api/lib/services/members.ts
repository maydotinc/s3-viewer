import { MEMBER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import {
   isBucketAllowed,
   type BucketScopeSettings,
} from "@/lib/services/servers";
import type { $Enums, Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   ROLE_LABELS,
   canManageRole,
   effectiveBucketRole,
   isAtLeast,
   rolesAbove,
} from "@s3-viewer/permissions";
import {
   BucketAccessEntry,
   ErrorCode,
   Role,
   ServerUser,
   type UpdateRoleInput,
} from "@s3-viewer/types";

type BucketGrant = NonNullable<UpdateRoleInput["bucketAccess"]>[number];
type BucketRow = { bucketName: string; role: $Enums.Role };

const bucketGrantSelect = {
   bucketName: true,
   role: true,
} satisfies Prisma.BucketAccessSelect;

const toBucketEntry = (row: BucketRow): BucketAccessEntry => ({
   bucketName: row.bucketName,
   role: Role[row.role],
});

const memberSelect = (serverId: string) =>
   ({
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

const listMembers = async (serverId: string): Promise<ServerUser[]> => {
   const rows = await prisma.serverAccess.findMany({
      where: { serverId },
      select: memberSelect(serverId),
      orderBy: { createdAt: "asc" },
   });
   return rows.map(toServerUser);
};

const findMember = async (
   serverId: string,
   userId: string
): Promise<ServerUser | null> => {
   const row = await prisma.serverAccess.findUnique({
      where: { userId_serverId: { userId, serverId } },
      select: memberSelect(serverId),
   });
   return row ? toServerUser(row) : null;
};

type GrantingActor = {
   serverRole: Role;
   bucketRoles: ReadonlyMap<string, Role>;
};

const loadGrantingActor = async (
   userId: string,
   serverId: string,
   serverRole: Role,
   grants: readonly BucketGrant[]
): Promise<GrantingActor> => {
   const bucketNames = grants.map((g) => g.bucketName);
   if (serverRole === Role.OWNER || bucketNames.length === 0) {
      return { serverRole, bucketRoles: new Map() };
   }
   const rows = await prisma.bucketAccess.findMany({
      where: { userId, serverId, bucketName: { in: bucketNames } },
      select: bucketGrantSelect,
   });
   return {
      serverRole,
      bucketRoles: new Map(rows.map((r) => [r.bucketName, Role[r.role]])),
   };
};

const loadBucketGrants = (
   userId: string,
   serverId: string
): Promise<BucketRow[]> =>
   prisma.bucketAccess.findMany({
      where: { userId, serverId },
      select: bucketGrantSelect,
   });

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

const assertBucketGrants = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   grants: readonly BucketGrant[]
): void => {
   assertUniqueBuckets(grants);
   for (const { bucketName, role } of grants) {
      if (!isBucketAllowed(scope, bucketName)) {
         throw new ApiHttpError(
            400,
            `Unknown bucket: ${bucketName}`,
            ErrorCode.VALIDATION
         );
      }
      if (!canManageRole(actor.serverRole, Role[role])) {
         throw new ApiHttpError(
            403,
            `You can't grant ${ROLE_LABELS[Role[role]]} on ${bucketName}`
         );
      }
      const held = effectiveBucketRole(
         actor.serverRole,
         actor.bucketRoles.get(bucketName) ?? null
      );
      if (!isAtLeast(held, Role[role])) {
         throw new ApiHttpError(
            403,
            `You don't have ${ROLE_LABELS[Role[role]]} access to ${bucketName}, so you can't grant it`
         );
      }
   }
};

const assertBucketGrantChanges = (
   actor: GrantingActor,
   scope: BucketScopeSettings,
   current: readonly BucketRow[],
   grants: readonly BucketGrant[]
): void => {
   assertUniqueBuckets(grants);
   const held = new Map(current.map((row) => [row.bucketName, Role[row.role]]));
   assertBucketGrants(
      actor,
      scope,
      grants.filter((g) => held.get(g.bucketName) !== Role[g.role])
   );
   const kept = new Set(grants.map((g) => g.bucketName));
   for (const [bucketName, role] of held) {
      if (!kept.has(bucketName) && !canManageRole(actor.serverRole, role)) {
         throw new ApiHttpError(
            403,
            `You can't remove ${ROLE_LABELS[role]} access to ${bucketName}`
         );
      }
   }
};

const clampBucketAccess = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   role: Role
): Promise<void> => {
   const above = rolesAbove(role);
   if (above.length === 0) return;
   await tx.bucketAccess.updateMany({
      where: { userId, serverId, role: { in: above } },
      data: { role },
   });
};

const replaceBucketAccess = async (
   tx: Prisma.TransactionClient,
   userId: string,
   serverId: string,
   grants: readonly BucketGrant[]
): Promise<void> => {
   await tx.bucketAccess.deleteMany({ where: { userId, serverId } });
   if (grants.length === 0) return;
   await tx.bucketAccess.createMany({
      data: grants.map((g) => ({ userId, serverId, ...g })),
   });
};

const removeMembership = async (
   userId: string,
   serverId: string
): Promise<void> => {
   const [, removed] = await prisma.$transaction([
      prisma.bucketAccess.deleteMany({ where: { userId, serverId } }),
      prisma.serverAccess.deleteMany({ where: { userId, serverId } }),
   ]);
   if (removed.count === 0) throw new ApiHttpError(404, MEMBER_NOT_FOUND);
};

export {
   assertBucketGrantChanges,
   assertBucketGrants,
   bucketGrantSelect,
   clampBucketAccess,
   findMember,
   listMembers,
   loadBucketGrants,
   loadGrantingActor,
   removeMembership,
   replaceBucketAccess,
   toBucketEntry,
};
export type { BucketRow, GrantingActor };
