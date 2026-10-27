import { ApiHttpError } from "@/lib/http";
import { withBucketCreation } from "@/lib/s3/bucket-creation-coordination";
import { BucketExistsError, createNewBucket } from "@/lib/s3/bucket-create";
import {
   getS3ClientFromCredentials,
   type CredentialSnapshot,
} from "@/lib/s3/client-cache";
import { canHeadBucket } from "@/lib/s3/probe";
import { openStoredCredentials } from "@/lib/s3/stored-credentials";
import { bucketGrantSelect } from "@/lib/services/bucket-grants";
import { assertBucketCount } from "@/lib/services/grant-rules";
import { revokeInvalidInvites } from "@/lib/services/invite-authority";
import {
   lockBucketScope,
   type BucketScopeSettings,
} from "@/lib/services/servers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { Permission } from "@s3-viewer/permissions";
import { Role, type AuditEntry } from "@s3-viewer/shared";

const CREATE_PERMISSION_CHANGED =
   "Your permission to create buckets changed. The bucket was created in storage, but no access was granted.";

type BucketCreationRequest = {
   serverId: string;
   bucketName: string;
   userId: string;
   serverRole: Role;
   scope: BucketScopeSettings;
   snapshot: CredentialSnapshot;
   signal: AbortSignal;
};

// the caller owns authorization and the audit trail, so the service reaches both through these.
type BucketCreationHooks = {
   lockedRole: (
      tx: Prisma.TransactionClient,
      permission: Permission,
      message: string
   ) => Promise<Role>;
   refuse: (permission: Permission, message: string) => Error;
   // storage already holds the bucket, so the trail says so even when no access follows.
   recordUngranted: () => Promise<void>;
};

type GrantedBucket = Prisma.BucketAccessGetPayload<{
   select: typeof bucketGrantSelect;
}>;

type CreatedBucketAccess = {
   access: typeof Role.OWNER | GrantedBucket;
   cleared: number;
   revoked: AuditEntry[];
   existing: boolean;
};

const grantCreatedBucket = (
   { serverId, bucketName, userId, snapshot }: BucketCreationRequest,
   hooks: BucketCreationHooks,
   startedAt: Date,
   permission: Permission
) =>
   prisma.$transaction(async (tx) => {
      await lockBucketScope(tx, serverId);
      const current = await tx.server.findUnique({
         where: { id: serverId },
         select: { credentials: true, provider: true, restrictedBuckets: true },
      });
      if (
         !current ||
         current.credentials !== snapshot.credentials ||
         current.provider !== snapshot.provider
      ) {
         throw new ApiHttpError(
            409,
            "Server credentials changed while the bucket was being created. No bucket access was added."
         );
      }
      const currentRole = await hooks.lockedRole(
         tx,
         permission,
         CREATE_PERMISSION_CHANGED
      );
      if (current.restrictedBuckets && currentRole !== Role.OWNER)
         throw hooks.refuse(permission, CREATE_PERMISSION_CHANGED);
      // only the owner may clear other members' grants left on the name; a creator's own stale row makes way for the new one.
      const stale = await tx.bucketAccess.deleteMany({
         where: {
            serverId,
            bucketName,
            updatedAt: { lt: startedAt },
            ...(currentRole !== Role.OWNER && { userId }),
         },
      });
      const revoked =
         stale.count > 0 ? await revokeInvalidInvites(tx, serverId) : [];
      await tx.$executeRaw`
         UPDATE "server"
         SET "allowedBuckets" = array_append("allowedBuckets", ${bucketName})
         WHERE "id" = ${serverId}
           AND "restrictedBuckets"
           AND NOT (${bucketName} = ANY("allowedBuckets"))
      `;
      const outcome = { cleared: stale.count, revoked };
      if (currentRole === Role.OWNER) return { ...outcome, access: Role.OWNER };
      const grant = await tx.bucketAccess.upsert({
         where: {
            userId_serverId_bucketName: { userId, serverId, bucketName },
         },
         create: { userId, serverId, bucketName, role: currentRole },
         update: {},
         select: bucketGrantSelect,
      });
      return { ...outcome, access: grant };
   });

const createBucket = async (
   request: BucketCreationRequest,
   hooks: BucketCreationHooks
): Promise<CreatedBucketAccess> => {
   const { serverId, bucketName, userId, serverRole, scope, snapshot, signal } =
      request;
   if (scope.restrictedBuckets && serverRole !== Role.OWNER)
      throw hooks.refuse(
         Permission.CREATE_BUCKET,
         "Only the server owner can create a bucket on a server restricted to an allow-list."
      );
   if (serverRole !== Role.OWNER)
      assertBucketCount(
         await prisma.bucketAccess.count({ where: { userId, serverId } }),
         1
      );
   const credentials = await openStoredCredentials(
      serverId,
      snapshot.credentials,
      snapshot.ownerId
   );
   const provider = snapshot.provider;
   const client = getS3ClientFromCredentials(credentials, provider, serverId);
   const startedAt = new Date();
   const allowBucket = async (permission: Permission) => {
      try {
         return await grantCreatedBucket(request, hooks, startedAt, permission);
      } catch (error) {
         await hooks.recordUngranted();
         throw error;
      }
   };
   // the owner's way back to a bucket that was removed from an allow-listed server.
   const attachable = async (error: unknown): Promise<boolean> =>
      error instanceof BucketExistsError &&
      serverRole === Role.OWNER &&
      scope.restrictedBuckets &&
      !scope.allowedBuckets.includes(bucketName) &&
      (await canHeadBucket(client, bucketName, signal));
   return withBucketCreation(
      { endpoint: credentials.endpoint, bucketName, userId },
      async (lifecycle) => {
         try {
            await createNewBucket(
               client,
               provider,
               bucketName,
               signal,
               lifecycle
            );
         } catch (error) {
            if (!(await attachable(error))) throw error;
            return {
               ...(await allowBucket(Permission.UPDATE_CREDENTIALS)),
               existing: true,
            };
         }
         return {
            ...(await allowBucket(Permission.CREATE_BUCKET)),
            existing: false,
         };
      }
   );
};

export { createBucket };
