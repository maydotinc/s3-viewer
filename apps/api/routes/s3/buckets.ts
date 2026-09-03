import { noContent } from "@/lib/http";
import { getAuth, type AuthContext } from "@/lib/middleware/authorize";
import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { getS3Client } from "@/lib/s3/client-cache";
import { throwHttpError, throwListBucketsError } from "@/lib/s3/errors";
import { bucketGrantSelect } from "@/lib/services/members";
import { isBucketAllowed, loadServerSettings } from "@/lib/services/servers";
import {
   CreateBucketCommand,
   ListBucketsCommand,
   type BucketLocationConstraint,
   type S3Client,
} from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { Permission, isAtLeast } from "@s3-viewer/permissions";
import {
   Provider,
   Role,
   bucketScope,
   serverScope,
   type BucketScope,
   type S3Bucket,
   type ServerScope,
} from "@s3-viewer/types";
import { Router } from "express";

const MAX_BUCKET_PAGES = 50;

const bucketsRouter = Router({ mergeParams: true });

const loadAllowedBuckets = async (serverId: string): Promise<string[]> =>
   (await loadServerSettings(serverId)).allowedBuckets;

const toBucket = (
   name: string,
   userRole: Role,
   creationDate: string | null = null
): S3Bucket => ({ name, creationDate, userRole });

const createBucketConfiguration = async (
   client: S3Client,
   provider: Provider
) => {
   if (provider !== Provider.S3) return undefined;
   const region = await client.config.region();
   return region === "us-east-1"
      ? undefined
      : { LocationConstraint: region as BucketLocationConstraint };
};

const listAllBuckets = async (client: S3Client): Promise<S3Bucket[]> => {
   const buckets: S3Bucket[] = [];
   let token: string | undefined;
   for (let page = 0; page < MAX_BUCKET_PAGES; page++) {
      const out = await client
         .send(new ListBucketsCommand({ ContinuationToken: token }))
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
   { userId, serverRole }: AuthContext
): Promise<S3Bucket[]> => {
   const allowedBuckets = await loadAllowedBuckets(serverId);
   if (serverRole !== Role.OWNER) {
      const grants = await prisma.bucketAccess.findMany({
         where: { userId, serverId },
         select: bucketGrantSelect,
         orderBy: { bucketName: "asc" },
      });
      return grants
         .filter((g) => isBucketAllowed(allowedBuckets, g.bucketName))
         .map((g) => toBucket(g.bucketName, Role[g.role]));
   }
   if (allowedBuckets.length > 0) {
      return allowedBuckets.map((name) => toBucket(name, Role.OWNER));
   }
   return listAllBuckets(await getS3Client(serverId));
};

bucketsRouter.get(
   "/",
   ...serverRoute(Permission.LIST_BUCKETS, serverScope, async (req, res) => {
      const { serverId } = input<ServerScope>(res);
      res.json({ buckets: await visibleBuckets(serverId, getAuth(res)) });
   })
);

bucketsRouter.post(
   "/",
   ...serverRoute(Permission.CREATE_BUCKET, bucketScope, async (req, res) => {
      const { serverId, bucketName } = input<BucketScope>(res);
      const { userId, serverRole } = getAuth(res);

      const [client, { allowedBuckets, provider }] = await Promise.all([
         getS3Client(serverId),
         loadServerSettings(serverId),
      ]);
      await client
         .send(
            new CreateBucketCommand({
               Bucket: bucketName,
               CreateBucketConfiguration: await createBucketConfiguration(
                  client,
                  Provider[provider]
               ),
            })
         )
         .catch(throwHttpError);

      if (!isBucketAllowed(allowedBuckets, bucketName)) {
         await prisma.server.update({
            where: { id: serverId },
            data: { allowedBuckets: { push: bucketName } },
         });
      }

      let userRole: Role = Role.OWNER;
      if (serverRole !== Role.OWNER) {
         userRole = isAtLeast(serverRole, Role.ADMIN) ? Role.ADMIN : serverRole;
         await prisma.bucketAccess.upsert({
            where: {
               userId_serverId_bucketName: { userId, serverId, bucketName },
            },
            create: { userId, serverId, bucketName, role: userRole },
            update: {},
         });
      }

      res.status(201).json({
         bucket: toBucket(bucketName, userRole, new Date().toISOString()),
      });
   })
);

bucketsRouter.delete(
   "/:bucketName",
   ...serverRoute(Permission.DELETE_BUCKET, bucketScope, async (req, res) => {
      const { serverId, bucketName } = input<BucketScope>(res);
      const allowedBuckets = await loadAllowedBuckets(serverId);
      await prisma.$transaction([
         prisma.server.update({
            where: { id: serverId },
            data: {
               allowedBuckets: allowedBuckets.filter((b) => b !== bucketName),
            },
         }),
         prisma.bucketAccess.deleteMany({ where: { serverId, bucketName } }),
      ]);
      noContent(res);
   })
);

export { bucketsRouter };
