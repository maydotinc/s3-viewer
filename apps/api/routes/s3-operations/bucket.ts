import {
   requireCreateBucket,
   requireDeleteBucket,
   requireListBuckets,
} from "@/lib/middleware/permissions";
import { getS3Client } from "@/lib/utils/s3-client";
import { validateBody, validateQuery } from "@/lib/middleware/validation";
import {
   CreateBucketCommand,
   DeleteBucketCommand,
   ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import {
   bucketBodySchema,
   listBucketsQuerySchema,
   Role,
   S3Bucket,
} from "@s3-viewer/types";
import { Request, Response, Router } from "express";

const bucketRouter: Router = Router();

bucketRouter.put(
   "/create",
   validateBody(bucketBodySchema),
   requireCreateBucket(),
   async (req: Request, res: Response) => {
      const { bucketName, serverId } = req.body;
      try {
         const s3Client = await getS3Client(serverId);
         const command = new CreateBucketCommand({ Bucket: bucketName });
         await s3Client.send(command);
         res.status(201).json({
            message: `Bucket ${bucketName} created successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

bucketRouter.delete(
   "/delete",
   validateBody(bucketBodySchema),
   requireDeleteBucket(),
   async (req: Request, res: Response) => {
      const { bucketName, serverId } = req.body;

      try {
         const s3Client = await getS3Client(serverId);
         const command = new DeleteBucketCommand({ Bucket: bucketName });
         await s3Client.send(command);
         res.status(200).json({
            message: `Bucket ${bucketName} deleted successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

bucketRouter.delete(
   "/remove",
   validateBody(bucketBodySchema),
   requireDeleteBucket(),
   async (req: Request, res: Response) => {
      const { bucketName, serverId } = req.body;
      try {
         const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { allowedBuckets: true },
         });
         if (!server) {
            res.status(404).json({ error: "Server not found" });
            return;
         }
         const updated = (server.allowedBuckets ?? []).filter(
            (b) => b !== bucketName
         );
         await prisma.server.update({
            where: { id: serverId },
            data: { allowedBuckets: updated },
         });
         await prisma.bucketAccess.deleteMany({
            where: { serverId, bucketName },
         });
         res.status(200).json({
            message: `Bucket ${bucketName} removed from server`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

bucketRouter.get(
   "/list",
   validateQuery(listBucketsQuerySchema),
   requireListBuckets(),
   async (req: Request, res: Response) => {
      console.log("Listing buckets");
      const serverId = req.query.serverId as string;
      let buckets: S3Bucket[] = [];
      try {
         const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { allowedBuckets: true },
         });

         if (server?.allowedBuckets && server.allowedBuckets.length > 0) {
            buckets = server.allowedBuckets.map((name) => ({
               Name: name,
               CreationDate: "",
            }));
         } else {
            let contToken: string | undefined;
            const s3Client = await getS3Client(serverId);
            do {
               const command = new ListBucketsCommand({
                  ...(contToken && { ContinuationToken: contToken }),
               });
               const response = await s3Client.send(command);
               contToken = response.ContinuationToken;

               buckets.push(
                  ...(response.Buckets?.map((bucket) => ({
                     Name: bucket.Name || "",
                     CreationDate:
                        bucket.CreationDate?.toISOString() || "",
                  })) || [])
               );
            } while (contToken);
         }

         const userRole = req.userRole;
         if (userRole === Role.OWNER) {
            const bucketsWithRole = buckets.map((b) => ({
               ...b,
               userRole: Role.OWNER,
            }));
            res.status(200).json({ buckets: bucketsWithRole });
            return;
         }

         const userBucketAccess = await prisma.bucketAccess.findMany({
            where: {
               userId: req.user!.id,
               serverId,
            },
            select: { bucketName: true, role: true },
         });
         const bucketRoleMap = new Map(
            userBucketAccess.map((ba) => [ba.bucketName, ba.role as Role])
         );
         const filteredBuckets = buckets
            .filter((b) => bucketRoleMap.has(b.Name))
            .map((b) => ({
               ...b,
               userRole: bucketRoleMap.get(b.Name),
            }));
         res.status(200).json({ buckets: filteredBuckets });
      } catch (error: any) {
         console.error("Error listing buckets:", error);
         res.status(500).json({ error: "Error listing buckets" });
      }
   }
);

export default bucketRouter;
