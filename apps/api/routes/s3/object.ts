import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response, Router } from "express";
import { Readable } from "stream";
import { s3Client } from "../../lib/s3.js";

const objectRouter: Router = Router();

objectRouter.put("/create", async (req: Request, res: Response) => {
    const { bucketName, objectKey, file, contentType } = req.body;
    const buffer = Buffer.from(file);
    const command = new PutObjectCommand({ Bucket: bucketName, Key: objectKey, Body: buffer, ContentType: contentType });
    try {
        await s3Client.send(command);
        res.status(200).json({ message: `Object ${objectKey} created successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

objectRouter.get("/get", async (req: Request, res: Response) => {
    const { bucketName, objectKey } = req.body;
    const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
    try {
        const response = await s3Client.send(command);
        
        res.setHeader('Content-Type', response.ContentType || 'application/octet-stream');
        if (response.ContentLength) {
            res.setHeader('Content-Length', response.ContentLength);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${(objectKey as string).split('/').pop()}"`);
        if (response.ETag) {
            res.setHeader('ETag', response.ETag);
        }
        if (response.LastModified) {
            res.setHeader('Last-Modified', response.LastModified.toUTCString());
        }
        
        const stream = response.Body as Readable;
        stream.pipe(res);
        return new Promise((resolve) => {
            stream.on('end', resolve);
            stream.on('error', resolve);
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

objectRouter.delete("/delete", async (req: Request, res: Response) => {
    const { bucketName, objectKey } = req.body;
    const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey });
    try {
        await s3Client.send(command);
        res.status(200).json({ message: `Object ${objectKey} deleted successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

objectRouter.post("/copy", async (req: Request, res: Response) => {
    const { sourceBucket, sourceKey, targetBucket, targetKey } = req.body;
    const command = new CopyObjectCommand({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${sourceBucket}/${sourceKey}`
    });
    try {
        await s3Client.send(command);
        res.status(200).json({ message: `Object ${sourceKey} copied to ${targetBucket}/${targetKey}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

objectRouter.post("/move", async (req: Request, res: Response) => {
    const { sourceBucket, sourceKey, targetBucket, targetKey } = req.body;
    const command = new CopyObjectCommand({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${sourceBucket}/${sourceKey}`
    });
    const deleteCommand = new DeleteObjectCommand({
        Bucket: sourceBucket,
        Key: sourceKey
    });
    try {
        await s3Client.send(command);
        await s3Client.send(deleteCommand);
        res.status(200).json({ message: `Object ${sourceKey} moved to ${targetBucket}/${targetKey}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default objectRouter;
