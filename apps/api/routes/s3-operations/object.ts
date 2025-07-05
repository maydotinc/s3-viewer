import {
   CopyObjectCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   ListObjectsV2Command,
   PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Request, Response, Router } from "express";
import { Readable } from "stream";
import {
   requireDeleteObject,
   requireDownloadObject,
   requireListObjects,
   requireMoveObject,
   requireUploadObject,
} from "../../lib/middleware/permissions.js";
import { getS3Client } from "../../lib/utils/s3-client.js";

const objectRouter: Router = Router();

objectRouter.put(
   "/create",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, file, contentType, serverId } = req.body;

      const s3Client = await getS3Client(serverId);
      const buffer = Buffer.from(file);
      const command = new PutObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
         Body: buffer,
         ContentType: contentType,
      });
      try {
         await s3Client.send(command);
         res.status(200).json({
            message: `Object ${objectKey} created successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.get(
   "/get",
   requireDownloadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, serverId } = req.body;

      const s3Client = await getS3Client(serverId);
      const command = new GetObjectCommand({
         Bucket: bucketName,
         Key: objectKey,
      });
      try {
         const response = await s3Client.send(command);

         res.setHeader(
            "Content-Type",
            response.ContentType || "application/octet-stream"
         );
         if (response.ContentLength) {
            res.setHeader("Content-Length", response.ContentLength);
         }
         res.setHeader(
            "Content-Disposition",
            `attachment; filename="${(objectKey as string).split("/").pop()}"`
         );
         if (response.ETag) {
            res.setHeader("ETag", response.ETag);
         }
         if (response.LastModified) {
            res.setHeader("Last-Modified", response.LastModified.toUTCString());
         }

         const stream = response.Body as Readable;
         stream.pipe(res);
         return new Promise((resolve) => {
            stream.on("end", resolve);
            stream.on("error", resolve);
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
