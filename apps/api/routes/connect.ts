import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { ServerCredentials } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import { getS3ClientFromCredentials } from "../lib/s3.js";
import authGuard from "../utils/auth.js";

const connectRouter: Router = Router();
connectRouter.use(authGuard);

connectRouter.post("/establish", async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const credentials = req.body as ServerCredentials;
    const s3Client = getS3ClientFromCredentials(credentials);
    const response = await s3Client.send(new ListBucketsCommand({}));
    if (response.Buckets) {
        res.status(200).json({ message: "Server connected established successfully" });
    } else {
        res.status(400).json({ message: "Server connection failed, are you sure you're using the correct credentials?" });
    }
});

connectRouter.post("/create", async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { serverCredentials, serverName } = req.body as { serverCredentials: ServerCredentials, serverName: string };

    try {
        const server = await prisma.server.create({
            data: {
                credentials: JSON.stringify(serverCredentials),
                name: serverName,
                ownerId: req.user.id,
                serverAccess: {
                    create: {
                        userId: req.user.id,
                        role: 'OWNER',
                        canReadBuckets: true,
                        canCreateBuckets: true,
                        canDeleteBuckets: true,
                        canModifyFiles: true,
                        canModifyCors: true
                    }
                }
            },
        });
        res.status(200).json({ message: "Server created successfully", serverId: server.id });
    } catch (error) {
        res.status(400).json({ message: "Server creation failed: " + error });
    }
});

connectRouter.delete("/delete", async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { serverId } = req.body;
    try {
        await prisma.server.delete({
            where: { id: serverId }
        });
        res.status(200).json({ message: "Server deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: "Server deletion failed: " + error });
    }
});

export default connectRouter;