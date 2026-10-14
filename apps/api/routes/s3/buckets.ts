import { S3_ROUTE_TIMEOUT_MS, SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, noContent, requestSignal } from "@/lib/http";
import { recordMany } from "@/lib/middleware/audit-record";
import {
   authorizeBucket,
   getAuth,
   lockedPermission,
   refuse,
   type AuthContext,
} from "@/lib/middleware/authorize";
import { bucketCreateLimit } from "@/lib/middleware/rate-limit";
import { bucketRoute, serverRoute, wholeBucket } from "@/lib/middleware/route";
import { withBucketCreation } from "@/lib/s3/bucket-creation-coordination";
import { createNewBucket } from "@/lib/s3/bucket-create";
import { listBuckets } from "@/lib/s3/bucket-listing";
import { getS3Client, getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import {
   credentialsUnreadableError,
   throwListBucketsError,
} from "@/lib/s3/errors";
import {
   canRevokeInvite,
   revocableInviteSelect,
   revokeInvalidInvites,
} from "@/lib/services/invite-authority";
import { loadGrantingActor } from "@/lib/services/members";
import {
   bucketGrantSelect,
   findUnremovableGrant,
   grantFoldersOf,
} from "@/lib/services/bucket-grants";
import {
   assertBucketRemovable,
   isBucketAllowed,
   lockBucketScope,
} from "@/lib/services/servers";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { decryptCredentials } from "@/lib/utils/encryption";
import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import { Permission, ROLE_LABELS } from "@s3-viewer/permissions";
import {
   Provider,
   Role,
   bucketScope,
   newBucketScope,
   serverScope,
   type S3Bucket,
   type ServerCredentials,
} from "@s3-viewer/types";
import { Router } from "express";

const bucketsRouter = Router({ mergeParams: true });

const CREATE_PERMISSION_CHANGED =
   "Your permission to create buckets changed. The bucket was created in storage, but no access was granted.";

const toBucket = (
   name: string,
   userRole: Role,
   creationDate: string | null = null,
   folders: string[] | null = null
): S3Bucket => ({ name, creationDate, userRole, folders });

const visibleBuckets = async (
   auth: AuthContext,
   signal: AbortSignal
): Promise<S3Bucket[]> => {
   const { userId, serverId, serverRole, bucketScope: scope } = auth;
   if (serverRole !== Role.OWNER) {
      const grants = await prisma.bucketAccess.findMany({
         where: { userId, serverId },
         select: bucketGrantSelect,
         orderBy: { bucketName: "asc" },
      });
      return grants
         .filter((g) => isBucketAllowed(scope, g.bucketName))
         .map((g) =>
            toBucket(g.bucketName, Role[g.role], null, grantFoldersOf(g))
         );
   }
   if (scope.restrictedBuckets) {
      return scope.allowedBuckets.map((name) => toBucket(name, Role.OWNER));
   }
   return (
      await listBuckets(
         await getS3Client(auth, undefined, signal),
         signal
      ).catch(throwListBucketsError)
   ).map((bucket) =>
      toBucket(
         bucket.Name!,
         Role.OWNER,
         bucket.CreationDate?.toISOString() ?? null
      )
   );
};

bucketsRouter.get(
   "/",
   ...serverRoute(Permission.LIST_BUCKETS, serverScope, async (_req, res) => {
      res.json({
         buckets: await visibleBuckets(
            getAuth(res),
            requestSignal(res, S3_ROUTE_TIMEOUT_MS)
         ),
      });
   })
);

bucketsRouter.post(
   "/",
   bucketCreateLimit,
   ...serverRoute(
      Permission.CREATE_BUCKET,
      newBucketScope,
      async (_req, res, input) => {
         const { serverId, bucketName } = input;
         const {
            userId,
            serverRole,
            bucketScope: scope,
            credentials: snapshot,
         } = getAuth(res);
         const signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS);

         if (!snapshot) throw new ApiHttpError(404, SERVER_NOT_FOUND);
         if (scope.restrictedBuckets && serverRole !== Role.OWNER) {
            throw refuse(
               res,
               Permission.CREATE_BUCKET,
               "forbidden",
               "Only the server owner can create a bucket on a server restricted to an allow-list."
            );
         }
         let credentials: ServerCredentials;
         try {
            credentials = decryptCredentials(
               snapshot.credentials,
               snapshot.ownerId
            );
         } catch {
            throw credentialsUnreadableError();
         }
         await assertPublicEndpoint(credentials.endpoint);
         const provider = Provider[snapshot.provider];
         const client = getS3ClientFromCredentials(
            credentials,
            provider,
            serverId
         );
         const startedAt = new Date();
         const created = await withBucketCreation(
            { endpoint: credentials.endpoint, bucketName, userId },
            async (lifecycle) => {
               await createNewBucket(
                  client,
                  provider,
                  bucketName,
                  signal,
                  lifecycle
               );

               return prisma.$transaction(async (tx) => {
                  await lockBucketScope(tx, serverId);
                  const current = await tx.server.findUnique({
                     where: { id: serverId },
                     select: {
                        credentials: true,
                        provider: true,
                        restrictedBuckets: true,
                     },
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
                  const currentRole = await lockedPermission(
                     tx,
                     res,
                     serverId,
                     Permission.CREATE_BUCKET,
                     CREATE_PERMISSION_CHANGED
                  );
                  if (current.restrictedBuckets && currentRole !== Role.OWNER)
                     throw refuse(
                        res,
                        Permission.CREATE_BUCKET,
                        "forbidden",
                        CREATE_PERMISSION_CHANGED
                     );
                  const stale = await tx.bucketAccess.deleteMany({
                     where: {
                        serverId,
                        bucketName,
                        updatedAt: { lt: startedAt },
                     },
                  });
                  const revoked =
                     stale.count > 0
                        ? await revokeInvalidInvites(tx, serverId)
                        : [];
                  await tx.$executeRaw`
                     UPDATE "server"
                     SET "allowedBuckets" = array_append("allowedBuckets", ${bucketName})
                     WHERE "id" = ${serverId}
                       AND "restrictedBuckets"
                       AND NOT (${bucketName} = ANY("allowedBuckets"))
                  `;
                  const outcome = { cleared: stale.count, revoked };
                  if (currentRole === Role.OWNER)
                     return { ...outcome, access: Role.OWNER as const };
                  const grant = await tx.bucketAccess.upsert({
                     where: {
                        userId_serverId_bucketName: {
                           userId,
                           serverId,
                           bucketName,
                        },
                     },
                     create: {
                        userId,
                        serverId,
                        bucketName,
                        role: currentRole,
                     },
                     update: {},
                     select: bucketGrantSelect,
                  });
                  return { ...outcome, access: grant };
               });
            }
         );
         const { access, cleared, revoked } = created;
         await recordMany(res, [
            {
               action: "bucket.create",
               bucket: bucketName,
               ...(cleared > 0 && { detail: { clearedGrants: cleared } }),
            },
            ...revoked,
         ]);

         res.status(201).json({
            bucket:
               access === Role.OWNER
                  ? toBucket(bucketName, Role.OWNER, new Date().toISOString())
                  : toBucket(
                       bucketName,
                       Role[access.role],
                       new Date().toISOString(),
                       grantFoldersOf(access)
                    ),
         });
      }
   )
);

bucketsRouter.delete(
   "/:bucketName",
   ...bucketRoute(
      Permission.DELETE_BUCKET,
      bucketScope,
      wholeBucket,
      async (_req, res, input) => {
         const { serverId, bucketName } = input;
         const { userId } = getAuth(res);
         const revoked = await prisma.$transaction(async (tx) => {
            const scope = await lockBucketScope(tx, serverId);
            const auth = await authorizeBucket(
               userId,
               serverId,
               bucketName,
               Permission.DELETE_BUCKET,
               tx
            );
            assertBucketRemovable(scope, bucketName);
            // removing the bucket wipes everyone's grants on it, so the actor must be able to remove each of them.
            const peers = await tx.bucketAccess.findMany({
               where: { serverId, bucketName, userId: { not: userId } },
               select: bucketGrantSelect,
            });
            // revokeInvalidInvites below deletes each invite granting this bucket, all its grants included, so the actor must be able to revoke it.
            const invites = await tx.pendingInvitation.findMany({
               where: {
                  serverId,
                  ...liveInvite(),
                  bucketAccess: { some: { bucketName } },
               },
               select: revocableInviteSelect,
            });
            const actor = await loadGrantingActor(
               userId,
               serverId,
               auth.serverRole,
               [...peers, ...invites.flatMap((invite) => invite.bucketAccess)],
               tx
            );
            const blocking = findUnremovableGrant(
               actor.serverRole,
               actor.bucketGrants,
               peers
            );
            if (blocking) {
               throw refuse(
                  res,
                  Permission.DELETE_BUCKET,
                  "member",
                  `Other members hold ${ROLE_LABELS[Role[blocking.role]]} access to ${bucketName} that you can't remove, so you can't remove the bucket`
               );
            }
            // the message names no invitee: a bucket admin below server admin can't list invites.
            if (invites.some((invite) => !canRevokeInvite(actor, invite))) {
               throw refuse(
                  res,
                  Permission.DELETE_BUCKET,
                  "member",
                  `A pending invite carries access to ${bucketName} that you can't remove, so you can't remove the bucket`
               );
            }
            await tx.$executeRaw`UPDATE "server" SET "allowedBuckets" = array_remove("allowedBuckets", ${bucketName}) WHERE "id" = ${serverId}`;
            await tx.bucketAccess.deleteMany({
               where: { serverId, bucketName },
            });
            return revokeInvalidInvites(tx, serverId);
         });
         await recordMany(res, [
            { action: "bucket.remove", bucket: bucketName },
            ...revoked,
         ]);
         noContent(res);
      }
   )
);

export { bucketsRouter };
