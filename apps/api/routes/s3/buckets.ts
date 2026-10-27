import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import { noContent, requestSignal, serverNotFound } from "@/lib/http";
import { record, recordMany } from "@/lib/middleware/audit-record";
import {
   authorizeBucket,
   getAuth,
   lockedPermission,
   refuse,
   type AuthContext,
} from "@/lib/middleware/authorize";
import { bucketCreateLimit } from "@/lib/middleware/rate-limit";
import { bucketRoute, serverRoute, wholeBucket } from "@/lib/middleware/route";
import { listBuckets } from "@/lib/s3/bucket-listing";
import { getS3Client } from "@/lib/s3/client-cache";
import { rethrowFailure } from "@/lib/s3/classify";
import { createBucket } from "@/lib/services/buckets";
import {
   canRevokeInvite,
   revocableInviteSelect,
   revokeInvalidInvites,
} from "@/lib/services/invite-authority";
import { loadBucketGrants, loadGrantingActor } from "@/lib/services/members";
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
import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import { Permission, ROLE_LABELS } from "@s3-viewer/permissions";
import {
   Role,
   bucketScope,
   newBucketScope,
   serverScope,
   type CreatedBucket,
   type S3Bucket,
} from "@s3-viewer/shared";
import { Router } from "express";

const bucketsRouter = Router({ mergeParams: true });

const toBucket = (
   name: string,
   userRole: Role,
   creationDate: string | null = null,
   folders: string[] | null = null
): S3Bucket => ({ name, creationDate, userRole, folders });

const listableBuckets = async (
   auth: AuthContext,
   signal: AbortSignal
): Promise<S3Bucket[]> => {
   const { userId, serverId, serverRole, bucketScope: scope } = auth;
   if (serverRole !== Role.OWNER) {
      return (await loadBucketGrants(userId, serverId))
         .filter((g) => isBucketAllowed(scope, g.bucketName))
         .map((g) => toBucket(g.bucketName, g.role, null, grantFoldersOf(g)));
   }
   if (scope.restrictedBuckets) {
      return scope.allowedBuckets.map((name) => toBucket(name, Role.OWNER));
   }
   return (
      await listBuckets(
         await getS3Client(auth, undefined, signal),
         signal
      ).catch(rethrowFailure("bucketList"))
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
         buckets: await listableBuckets(
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
         if (!snapshot) throw serverNotFound();
         const created = await createBucket(
            {
               serverId,
               bucketName,
               userId,
               serverRole,
               scope,
               snapshot,
               signal: requestSignal(res, S3_ROUTE_TIMEOUT_MS),
            },
            {
               lockedRole: (tx, permission, message) =>
                  lockedPermission(tx, res, serverId, permission, message),
               refuse: (permission, message) =>
                  refuse(res, permission, "forbidden", message),
               recordUngranted: () =>
                  record(res, {
                     action: "bucket.create",
                     bucket: bucketName,
                     detail: { accessGranted: false },
                  }),
            }
         );
         const { access, cleared, revoked, existing } = created;
         await recordMany(res, [
            {
               action: "bucket.create",
               bucket: bucketName,
               ...((cleared > 0 || existing) && {
                  detail: {
                     ...(cleared > 0 && { clearedGrants: cleared }),
                     ...(existing && { existing: true }),
                  },
               }),
            },
            ...revoked,
         ]);

         const createdAt = existing ? null : new Date().toISOString();
         res.status(201).json({
            bucket:
               access === Role.OWNER
                  ? toBucket(bucketName, Role.OWNER, createdAt)
                  : toBucket(
                       bucketName,
                       access.role,
                       createdAt,
                       grantFoldersOf(access)
                    ),
            ...(existing && { existing: true as const }),
         } satisfies CreatedBucket);
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
                  `Other members hold ${ROLE_LABELS[blocking.role]} access to ${bucketName} that you can't remove, so you can't remove the bucket`
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
