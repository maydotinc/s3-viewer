import { ApiHttpError } from "@/lib/http";
import { isBucketAllowed } from "@/lib/services/servers";
import type { $Enums, Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { ROLE_LABELS, canManageRole } from "@s3-viewer/permissions";
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
            image: true,
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
   image: row.user.image ?? null,
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

const assertBucketGrants = (
   actorRole: Role,
   allowedBuckets: readonly string[],
   grants: readonly BucketGrant[]
): void => {
   const seen = new Set<string>();
   for (const { bucketName, role } of grants) {
      if (seen.has(bucketName)) {
         throw new ApiHttpError(
            400,
            `Duplicate bucket: ${bucketName}`,
            ErrorCode.VALIDATION
         );
      }
      seen.add(bucketName);
      if (!isBucketAllowed(allowedBuckets, bucketName)) {
         throw new ApiHttpError(
            400,
            `Unknown bucket: ${bucketName}`,
            ErrorCode.VALIDATION
         );
      }
      if (!canManageRole(actorRole, Role[role])) {
         throw new ApiHttpError(
            403,
            `You can't grant ${ROLE_LABELS[Role[role]]} on ${bucketName}`
         );
      }
   }
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

const removeMembership = (userId: string, serverId: string) =>
   prisma.$transaction([
      prisma.bucketAccess.deleteMany({ where: { userId, serverId } }),
      prisma.serverAccess.delete({
         where: { userId_serverId: { userId, serverId } },
      }),
   ]);

export {
   assertBucketGrants,
   bucketGrantSelect,
   findMember,
   listMembers,
   removeMembership,
   replaceBucketAccess,
   toBucketEntry,
};
