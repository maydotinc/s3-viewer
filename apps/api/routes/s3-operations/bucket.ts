import {
   CreateBucketCommand,
   DeleteBucketCommand,
   ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { S3Bucket } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import {
   requireCreateBucket,
   requireDeleteBucket,
   requireListBuckets,
} from "../../lib/middleware/permissions.js";
import { getS3Client } from "../../lib/utils/s3-client.js";

const bucketRouter: Router = Router();

bucketRouter.put(
   "/create",
   requireCreateBucket(),
   async (req: Request, res: Response) => {
      const { bucketName, serverId } = req.body;

      const s3Client = await getS3Client(serverId);
      const command = new CreateBucketCommand({ Bucket: bucketName });
      try {
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
   requireDeleteBucket(),
   async (req: Request, res: Response) => {
      const { bucketName, serverId } = req.body;

      const s3Client = await getS3Client(serverId);
      const command = new DeleteBucketCommand({ Bucket: bucketName });
      try {
         await s3Client.send(command);
         res.status(200).json({
            message: `Bucket ${bucketName} deleted successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

bucketRouter.get(
   "/list",
   requireListBuckets(),
   async (req: Request, res: Response) => {
      console.log("Listing buckets");
      const serverId = req.query.serverId as string;
      const buckets: S3Bucket[] = [];
      try {
         let contToken: string | undefined;
         // Loop through all buckets then return
         do {
            const s3Client = await getS3Client(serverId);
            const command = new ListBucketsCommand({
               MaxBuckets: 10000,
               ...(contToken && { ContinuationToken: contToken }),
            });
            const response = await s3Client.send(command);
            contToken = response.ContinuationToken;

            buckets.push(
               ...(response.Buckets?.map((bucket) => ({
                  Name: bucket.Name || "",
                  CreationDate: bucket.CreationDate?.toISOString() || "",
                  Files: 0,
                  Folders: 0,
                  TotalSize: 0,
               })) || [])
            );
         } while (contToken);
         res.status(200).json({ buckets });
      } catch (error: any) {
         console.error(error);
         res.status(500).json({ error: "Error listing buckets" });
      }
   }
);

export default bucketRouter;
