import {
   requireDeleteObject,
   requireDownloadObject,
   requireListObjects,
   requireMoveObject,
   requireUploadObject,
} from "@/lib/middleware/permissions";
import { getS3Client } from "@/lib/utils/s3-client";
import {
   AbortMultipartUploadCommand,
   CompleteMultipartUploadCommand,
   CopyObjectCommand,
   CreateMultipartUploadCommand,
   DeleteObjectCommand,
   DeleteObjectsCommand,
   GetObjectCommand,
   HeadObjectCommand,
   ListObjectsV2Command,
   ListPartsCommand,
   PutObjectCommand,
   S3ServiceException,
   UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Request, Response, Router } from "express";

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

         const filename = (objectKey as string).split("/").pop() || "download";
         const encodedFilename = encodeURIComponent(filename);
         const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;

         const command = new GetObjectCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
            ResponseContentDisposition: contentDisposition,
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

objectRouter.get(
   "/metadata",
   requireListObjects(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, serverId } = req.query;

      try {
         const s3Client = await getS3Client(serverId as string);
         const command = new HeadObjectCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
         });

         const response = await s3Client.send(command);

         res.status(200).json({
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            lastModified: response.LastModified,
            storageClass: response.StorageClass || "STANDARD",
         });
      } catch (error: any) {
         if (error.name === "NotFound") {
            res.status(404).json({ error: "Object not found" });
         } else {
            res.status(500).json({ error: error.message });
         }
      }
   }
);

objectRouter.get(
   "/preview",
   requireDownloadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, serverId, contentType } = req.query;

      try {
         const s3Client = await getS3Client(serverId as string);
         const command = new GetObjectCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
            ResponseContentType: contentType as string,
         });

         const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

         res.status(200).json({
            url,
            contentType,
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
      try {
         const s3Client = await getS3Client(serverId);
         const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
         });
         await s3Client.send(command);
         res.status(200).json({
            message: `Object ${objectKey} deleted successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.delete(
   "/delete-multiple",
   requireDeleteObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKeys, serverId } = req.body;
      try {
         const s3Client = await getS3Client(serverId);
         const command = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
               Objects: objectKeys.map((key: string) => ({ Key: key })),
            },
         });
         await s3Client.send(command);
         res.status(200).json({
            message: `${objectKeys.length} objects deleted successfully`,
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

      try {
         const s3Client = await getS3Client(serverId);
         const command = new CopyObjectCommand({
            Bucket: targetBucket,
            Key: targetKey,
            CopySource: `${sourceBucket}/${sourceKey}`,
         });
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

      try {
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

// Multipart Upload Endpoints
objectRouter.post(
   "/multipart/create",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { bucketName, objectKey, contentType, serverId } = req.body;

      try {
         const s3Client = await getS3Client(serverId);
         const command = new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: contentType,
         });

         const response = await s3Client.send(command);

         res.status(200).json({
            uploadId: response.UploadId,
            bucketName: response.Bucket,
            objectKey: response.Key,
            message: `Multipart upload initiated for ${objectKey}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.get(
   "/multipart/:uploadId/part/:partNumber/presigned-url",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { uploadId, partNumber } = req.params;
      const { bucketName, objectKey, serverId } = req.query;

      if (!serverId || !bucketName || !objectKey) {
         res.status(400).json({
            error: "serverId, bucketName, and objectKey are required",
         });
         return;
      }

      if (!partNumber || !uploadId) {
         res.status(400).json({
            error: "partNumber and uploadId are required",
         });
         return;
      }

      try {
         const s3Client = await getS3Client(serverId as string);
         const command = new UploadPartCommand({
            Bucket: bucketName as string,
            Key: objectKey as string,
            UploadId: uploadId,
            PartNumber: parseInt(partNumber),
         });

         const url = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

         res.status(200).json({
            url,
            uploadId,
            partNumber: parseInt(partNumber),
            message: `Presigned URL generated for part ${partNumber}`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

objectRouter.post(
   "/multipart/:uploadId/complete",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { uploadId } = req.params;
      const { bucketName, objectKey, serverId } = req.body;

      console.log("Completing multipart upload:", {
         uploadId,
         bucketName,
         objectKey,
         serverId,
      });

      try {
         const s3Client = await getS3Client(serverId);

         // List all uploaded parts to get their ETags
         const listPartsCommand = new ListPartsCommand({
            Bucket: bucketName,
            Key: objectKey,
            UploadId: uploadId,
         });
         const { Parts } = await s3Client.send(listPartsCommand);

         if (!Parts || Parts.length === 0) {
            throw new Error("No parts found for this multipart upload.");
         }

         const command = new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            UploadId: uploadId,
            MultipartUpload: {
               Parts: Parts.map((part) => ({
                  ETag: part.ETag,
                  PartNumber: part.PartNumber,
               })),
            },
         });

         const response = await s3Client.send(command);

         res.status(200).json({
            location: response.Location,
            bucketName: response.Bucket,
            objectKey: response.Key,
            etag: response.ETag,
            message: `Multipart upload completed for ${objectKey}`,
         });
      } catch (error: any) {
         if (error instanceof S3ServiceException) {
            console.log("S3ServiceException details:", {
               name: error.name,
               message: error.message,
               $fault: error.$fault,
               $metadata: error.$metadata,
            });
            res.status(501).json({ error: error.message });
         } else {
            console.log("General error:", error);
            res.status(500).json({ error: error.message });
         }
      }
   }
);

objectRouter.delete(
   "/multipart/:uploadId/abort",
   requireUploadObject(),
   async (req: Request, res: Response) => {
      const { uploadId } = req.params;
      const { bucketName, objectKey, serverId } = req.body;

      try {
         const s3Client = await getS3Client(serverId);
         const command = new AbortMultipartUploadCommand({
            Bucket: bucketName,
            Key: objectKey,
            UploadId: uploadId,
         });

         await s3Client.send(command);

         res.status(200).json({
            uploadId,
            message: `Multipart upload ${uploadId} aborted successfully`,
         });
      } catch (error: any) {
         res.status(500).json({ error: error.message });
      }
   }
);

export default objectRouter;
