import {
   CopyObjectCommand,
   DeleteObjectCommand,
   GetObjectCommand,
   PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Role } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import { Readable } from "stream";
import { getS3Client } from "../../lib/s3.js";
import authGuard from "../../lib/utils/auth.js";
import hasPermissions from "../../lib/utils/permission.js";

const objectRouter: Router = Router();
objectRouter.use(authGuard);

objectRouter.put("/create", async (req: Request, res: Response) => {
   const { bucketName, objectKey, file, contentType, serverId } = req.body;
   const user = req.user;
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!user) {
      res.status(401).json({ message: "Unauthorized, please login to continue" });
      return;
   }
   if (!(await hasPermissions(serverId, user.id, [Role.OWNER, Role.ADMIN, Role.EDITOR]))) {
      res.status(403).json({ message: "User does not have permission to create objects" });
      return;
   }
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
      res.status(200).json({ message: `Object ${objectKey} created successfully` });
   } catch (error: any) {
      res.status(500).json({ error: error.message });
   }
});

objectRouter.get("/get", async (req: Request, res: Response) => {
   const { bucketName, objectKey, serverId } = req.body;
   const user = req.user;
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!user) {
      res.status(401).json({ message: "Unauthorized, please login to continue" });
      return;
   }
   if (
      !(await hasPermissions(serverId, user.id, [Role.OWNER, Role.ADMIN, Role.EDITOR, Role.VIEWER]))
   ) {
      res.status(403).json({ message: "User does not have permission to get objects" });
      return;
   }
   const s3Client = await getS3Client(serverId);
   const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
   try {
      const response = await s3Client.send(command);

      res.setHeader("Content-Type", response.ContentType || "application/octet-stream");
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
});

objectRouter.delete("/delete", async (req: Request, res: Response) => {
   const { bucketName, objectKey, serverId } = req.body;
   const user = req.user;
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!user) {
      res.status(401).json({ message: "Unauthorized, please login to continue" });
      return;
   }
   if (!(await hasPermissions(serverId, user.id, [Role.OWNER, Role.ADMIN, Role.EDITOR]))) {
      res.status(403).json({ message: "User does not have permission to delete objects" });
      return;
   }
   const s3Client = await getS3Client(serverId);
   const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
   try {
      await s3Client.send(command);
      res.status(200).json({ message: `Object ${objectKey} deleted successfully` });
   } catch (error: any) {
      res.status(500).json({ error: error.message });
   }
});

objectRouter.post("/copy", async (req: Request, res: Response) => {
   const { sourceBucket, sourceKey, targetBucket, targetKey, serverId } = req.body;
   const user = req.user;
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!user) {
      res.status(401).json({ message: "Unauthorized, please login to continue" });
      return;
   }
   if (!(await hasPermissions(serverId, user.id, [Role.OWNER, Role.ADMIN, Role.EDITOR]))) {
      res.status(403).json({ message: "User does not have permission to copy objects" });
      return;
   }
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
});

objectRouter.post("/move", async (req: Request, res: Response) => {
   const { sourceBucket, sourceKey, targetBucket, targetKey, serverId } = req.body;
   const user = req.user;
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!user) {
      res.status(401).json({ message: "Unauthorized, please login to continue" });
      return;
   }
   if (!(await hasPermissions(serverId, user.id, [Role.OWNER, Role.ADMIN, Role.EDITOR]))) {
      res.status(403).json({ message: "User does not have permission to move objects" });
      return;
   }
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
});

export default objectRouter;
