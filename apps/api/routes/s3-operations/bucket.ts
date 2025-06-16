import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { Request, Response, Router } from "express";
import { getS3Client } from "../../lib/s3.js";
import authGuard from "../../utils/auth.js";
import formatBuckets from "../../utils/formatBuckets.js";
import hasPermissions from "../../utils/permission.js";

const bucketRouter: Router = Router();
bucketRouter.use(authGuard);

bucketRouter.put("/create", async (req: Request, res: Response) => {
    const { bucketName, serverId } = req.body;
    const user = req.user;
    if (!serverId) {
        res.status(400).json({ message: "Server ID is required" });
        return;
    }
    if (!user) {
        res.status(401).json({ message: "Unauthorized, please login to continue" });
        return;
    }

    if (!hasPermissions(serverId, user.id, ["OWNER", "ADMIN"])) {
        res.status(403).json({ message: "User does not have permission to create buckets" });
        return;
    }

    const s3Client = await getS3Client(serverId);
    const command = new CreateBucketCommand({ Bucket: bucketName });
    try {
        await s3Client.send(command);
        res.status(201).json({ message: `Bucket ${bucketName} created successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

bucketRouter.delete("/delete", async (req: Request, res: Response) => {
    const { bucketName, serverId } = req.body;
    const user = req.user;
    if (!serverId) {
        res.status(400).json({ message: "Server ID is required" });
        return;
    }
    if (!user) {
        res.status(401).json({ message: "Unauthorized, please login to continue" });
        return;
    }

    if (!hasPermissions(serverId, user.id, ["OWNER", "ADMIN"])) {
        res.status(403).json({ message: "User does not have permission to delete buckets" });
        return;
    }

    const s3Client = await getS3Client(serverId);
    const command = new DeleteBucketCommand({ Bucket: bucketName });
    try {
        await s3Client.send(command);
        res.status(200).json({ message: `Bucket ${bucketName} deleted successfully` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

bucketRouter.get("/list", async (req: Request, res: Response) => {
    const { serverId } = req.body;
    const user = req.user;
    if (!serverId) {
        res.status(400).json({ message: "Server ID is required" });
        return;
    }
    if (!user) {
        res.status(401).json({ message: "Unauthorized, please login to continue" });
        return;
    }

    if (!hasPermissions(serverId, user.id, ["OWNER", "ADMIN", "EDITOR", "VIEWER"])) {
        res.status(403).json({ message: "User does not have permission to list buckets" });
        return;
    }

    const s3Client = await getS3Client(serverId);
    const command = new ListBucketsCommand({});
    try {
        const response = await s3Client.send(command);
        res.status(200).json(formatBuckets(response));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default bucketRouter;
