import { S3_ROUTE_TIMEOUT_MS, SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError, noContent, requestSignal } from "@/lib/http";
import { getAuth, type AuthContext } from "@/lib/middleware/authorize";
import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { createNewBucket } from "@/lib/s3/bucket-create";
import { getS3Client, getS3ClientFromCredentials } from "@/lib/s3/client-cache";
import {
   credentialsUnreadableError,
   throwListBucketsError,
} from "@/lib/s3/errors";
import { recordAudit } from "@/lib/services/audit";
import { revokeInvalidInvites } from "@/lib/services/invite-authority";
import { bucketGrantSelect } from "@/lib/services/members";
import {
   assertBucketRemovable,
   isBucketAllowed,
   loadServerSettings,
   lockBucketScope,
} from "@/lib/services/servers";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { decryptCredentials } from "@/lib/utils/encryption";
import { ListBucketsCommand, type S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   Provider,
   Role,
   bucketScope,
   serverScope,
   type BucketScope,
   type S3Bucket,
   type ServerCredentials,
   type ServerScope,
} from "@s3-viewer/types";
import { Router } from "express";

const MAX_BUCKET_PAGES = 50;

const bucketsRouter = Router({ mergeParams: true });

const toBucket = (
   name: string,
   userRole: Role,
   creationDate: string | null = null
): S3Bucket => ({ name, creationDate, userRole });

const listAllBuckets = async (
   client: S3Client,
   signal: AbortSignal
): Promise<S3Bucket[]> => {
   const buckets: S3Bucket[] = [];
   let token: string | undefined;
   for (let page = 0; page < MAX_BUCKET_PAGES; page++) {
      const out = await client
         .send(new ListBucketsCommand({ ContinuationToken: token }), {
            abortSignal: signal,
         })
         .catch(throwListBucketsError);
      for (const bucket of out.Buckets ?? []) {
         if (!bucket.Name) continue;
         buckets.push(
            toBucket(
               bucket.Name,
               Role.OWNER,
               bucket.CreationDate?.toISOString() ?? null
            )
         );
      }
      token = out.ContinuationToken;
      if (!token) break;
   }
   return buckets;
};

const visibleBuckets = async (
   serverId: string,
   { userId, serverRole }: AuthContext,
   signal: AbortSignal
): Promise<S3Bucket[]> => {
   const scope = await loadServerSettings(serverId);
   if (serverRole !== Role.OWNER) {
      const grants = await prisma.bucketAccess.findMany({
         where: { userId, serverId },
         select: bucketGrantSelect,
         orderBy: { bucketName: "asc" },
      });
      return grants
         .filter((g) => isBucketAllowed(scope, g.bucketName))
         .map((g) => toBucket(g.bucketName, Role[g.role]));
   }
   if (scope.restrictedBuckets) {
      return scope.allowedBuckets.map((name) => toBucket(name, Role.OWNER));
   }
   return listAllBuckets(await getS3Client(serverId), signal);
};

bucketsRouter.get(
   "/",
   ...serverRoute(Permission.LIST_BUCKETS, serverScope, async (req, res) => {
      const { serverId } = input<ServerScope>(res);
      res.json({
         buckets: await visibleBuckets(
            serverId,
            getAuth(res),
            requestSignal(res, S3_ROUTE_TIMEOUT_MS)
         ),
      });
   })
);

bucketsRouter.post(
   "/",
   ...serverRoute(Permission.CREATE_BUCKET, bucketScope, async (req, res) => {
      const { serverId, bucketName } = input<BucketScope>(res);
      const { userId } = getAuth(res);
      const signal = requestSignal(res, S3_ROUTE_TIMEOUT_MS);

      // A cached client and a separate server read can describe different
      // storage accounts during credential rotation. Bind both the S3 work
      // and the final grants to this one database snapshot instead.
      const snapshot = await prisma.server.findUnique({
         where: { id: serverId },
         select: { credentials: true, provider: true },
      });
      if (!snapshot) throw new ApiHttpError(404, SERVER_NOT_FOUND);
      let credentials: ServerCredentials;
      try {
         credentials = decryptCredentials(snapshot.credentials);
      } catch {
         throw credentialsUnreadableError();
      }
      await assertPublicEndpoint(credentials.endpoint);
      const client = getS3ClientFromCredentials(
         credentials,
         Provider[snapshot.provider]
      );
      const userRole = await prisma.$transaction(
         async (tx) => {
            // Pin a connection for this bounded operation so API replicas and
            // duplicate server connections cannot both pass HeadBucket before
            // creating the same bucket. No permission rows are locked during S3.
            const lockKey = `bucket-create:${bucketName}`;
            const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
               SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})::bigint) AS locked
            `;
            if (!locked) {
               throw new ApiHttpError(
                  409,
                  `${bucketName} is already being created. Wait for that request to finish.`
               );
            }
            await createNewBucket(
               client,
               Provider[snapshot.provider],
               bucketName,
               signal
            );

            await lockBucketScope(tx, serverId);
            const current = await tx.server.findUnique({
               where: { id: serverId },
               select: { credentials: true, provider: true },
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
            const access = await tx.serverAccess.findUnique({
               where: { userId_serverId: { userId, serverId } },
               select: { role: true },
            });
            const currentRole = access ? Role[access.role] : null;
            if (
               !currentRole ||
               !hasPermission(currentRole, Permission.CREATE_BUCKET)
            ) {
               throw new ApiHttpError(
                  403,
                  "Your permission to create buckets changed. The bucket was created in storage, but no access was granted."
               );
            }
            await tx.$executeRaw`
               UPDATE "server"
               SET "allowedBuckets" = array_append("allowedBuckets", ${bucketName})
               WHERE "id" = ${serverId}
                 AND "restrictedBuckets"
                 AND NOT (${bucketName} = ANY("allowedBuckets"))
            `;
            if (currentRole === Role.OWNER) return Role.OWNER;
            const grant = await tx.bucketAccess.upsert({
               where: {
                  userId_serverId_bucketName: { userId, serverId, bucketName },
               },
               create: { userId, serverId, bucketName, role: currentRole },
               update: {},
               select: { role: true },
            });
            return Role[grant.role];
         },
         { timeout: S3_ROUTE_TIMEOUT_MS + 5_000 }
      );
      await recordAudit({
         action: "bucket.create",
         actorId: userId,
         serverId,
         target: bucketName,
      });

      res.status(201).json({
         bucket: toBucket(bucketName, userRole, new Date().toISOString()),
      });
   })
);

bucketsRouter.delete(
   "/:bucketName",
   ...serverRoute(Permission.DELETE_BUCKET, bucketScope, async (req, res) => {
      const { serverId, bucketName } = input<BucketScope>(res);
      const { userId } = getAuth(res);
      await prisma.$transaction(async (tx) => {
         assertBucketRemovable(await lockBucketScope(tx, serverId), bucketName);
         await tx.$executeRaw`UPDATE "server" SET "allowedBuckets" = array_remove("allowedBuckets", ${bucketName}) WHERE "id" = ${serverId}`;
         await tx.bucketAccess.deleteMany({ where: { serverId, bucketName } });
         await revokeInvalidInvites(tx, serverId);
      });
      await recordAudit({
         action: "bucket.remove",
         actorId: userId,
         serverId,
         target: bucketName,
      });
      noContent(res);
   })
);

export { bucketsRouter };
