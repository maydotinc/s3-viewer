import {
   CreateBucketCommand,
   DeleteBucketCommand,
   ListBucketsCommand,
} from "@aws-sdk/client-s3";
import { Request, Response, Router } from "express";
import {
   requireCreateBucket,
   requireDeleteBucket,
   requireListBuckets,
} from "../../lib/middleware/permissions.js";
import { getS3Client } from "../../lib/s3.js";
import formatBuckets from "../../lib/utils/formatBuckets.js";

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
      const serverId = req.query.serverId as string;

      const s3Client = await getS3Client(serverId);
      const command = new ListBucketsCommand({});
      try {
         const response = await s3Client.send(command);
         res.status(200).json(formatBuckets(response));
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

export default bucketRouter;
