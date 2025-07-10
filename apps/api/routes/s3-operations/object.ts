import {
   CopyObjectCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Request, Response, Router } from "express";
import {
   requireDeleteObject,
   requireDownloadObject,
   requireListObjects,
   requireMoveObject,
   requireUploadObject,
} from "../../lib/middleware/permissions.js";
import { getS3Client } from "../../lib/utils/s3-client.js";

const objectRouter: Router = Router();

objectRouter.get(
   "/presign-upload",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, contentType, serverId } = req.query;

      try {
         const s3Client = await getS3Client(serverId as string);
         const command = new PutObjectCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
            ContentType: contentType as string,
         });

         const url = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

         res.status(200).json({
            url,
            message: `Presigned upload URL generated for ${objectKey}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.get(
   "/presign-download",
   requireDownloadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, serverId } = req.query;

      try {
         const s3Client = await getS3Client(serverId as string);
         const command = new GetObjectCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
         });

         const url = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

         res.status(200).json({
            url,
            message: `Presigned download URL generated for ${objectKey}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.delete(
   "/delete",
   requireDeleteObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, serverId } = req.body;

      const s3Client = await getS3Client(serverId);
      const command = new DeleteObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
      });
      try {
         await s3Client.send(command);
         res.status(200).json({
            message: `Object ${objectKey} deleted successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.post(
   "/copy",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { sourceBucket, sourceKey, targetBucket, targetKey, serverId } =
         req.body;

      const s3Client = await getS3Client(serverId);
      const command = new CopyObjectCommand({
         Bucket: targetBucket,
         Key: targetKey,
         CopySource: `${sourceBucket}/${sourceKey}`,
      });
      try {
         await s3Client.send(command);
         res.status(200).json({
            message: `Object ${sourceKey} copied to ${targetBucket}/${targetKey}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.post(
   "/move",
   requireMoveObject(),
   async (req: Request, res: Response) => {
      const { sourceBucket, sourceKey, targetBucket, targetKey, serverId } =
         req.body;

      const s3Client = await getS3Client(serverId);
      const command = new CopyObjectCommand({
         Bucket: targetBucket,
         Key: targetKey,
         CopySource: `${sourceBucket}/${sourceKey}`,
      });
      const deleteCommand = new DeleteObjectCommand({
         Bucket: sourceBucket,
         Key: sourceKey,
      });
      try {
         await s3Client.send(command);
         await s3Client.send(deleteCommand);
         res.status(200).json({
            message: `Object ${sourceKey} moved to ${targetBucket}/${targetKey}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.get(
   "/list",
   requireListObjects(),
   async (req: Request, res: Response) => {
      const { bucket, serverId, continuationToken, blockSize, prefix } =
         req.query;
      console.log(
         "List objects",
         bucket,
         serverId,
         continuationToken,
         blockSize,
         prefix
      );
      const command = new ListObjectsV2Command({
         Bucket: bucket as string,
         ContinuationToken: continuationToken as string,
         MaxKeys: Number(blockSize),
         Delimiter: "/",
         ...(prefix && { Prefix: prefix as string }),
      });
      try {
         const s3Client = await getS3Client(serverId as string);
         const response = await s3Client.send(command);

         const files = response.Contents?.map((file) => ({
            Key: file.Key,
            Size: file.Size,
            LastModified: file.LastModified,
         }));

         const folders = response.CommonPrefixes?.map((folder) => ({
            Key: folder.Prefix,
            Size: null,
            LastModified: null,
         }));

         const nextToken = response.NextContinuationToken;

         res.status(200).json({
            objects: [...(folders || []), ...(files || [])],
            nextToken,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

export default objectRouter;
