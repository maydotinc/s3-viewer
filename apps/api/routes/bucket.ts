import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Request, Response, Router } from "express";
import { s3Client } from "../lib/s3.js";
import formatBuckets from "../utils/formatBuckets.js";
const bucketRouter: Router = Router();

bucketRouter.put("/create", async (req: Request, res: Response) => {
    const { bucketName } = req.body;
    const command = new CreateBucketCommand({ Bucket: bucketName });
    try {
        await s3Client.send(command);
        res.status(201).json({ message: `Bucket ${bucketName} created successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

bucketRouter.delete("/delete", async (req: Request, res: Response) => {
    const { bucketName } = req.body;
    const command = new DeleteBucketCommand({ Bucket: bucketName });
    try {
        await s3Client.send(command);
        res.status(200).json({ message: `Bucket ${bucketName} deleted successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

bucketRouter.get("/list", async (req: Request, res: Response) => {
    const command = new ListBucketsCommand({});    
    try {
        const response = await s3Client.send(command);
        res.status(200).json(formatBuckets(response));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default bucketRouter;
