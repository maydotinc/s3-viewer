import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { ServerCredentials } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import { getS3ClientFromCredentials } from "../../lib/s3.js";
import authGuard from "../../utils/auth.js";

const manageRouter: Router = Router();
manageRouter.use(authGuard);

manageRouter.post("/establish", async (req: Request, res: Response) => {
    console.log("Establishing connection");
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

manageRouter.post("/create", async (req: Request, res: Response) => {
    console.log("Creating server");
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
                        role: 'OWNER'
                    }
                }
            },
        });
        res.status(200).json({ message: "Server created successfully", serverId: server.id });
    } catch (error) {
        res.status(400).json({ message: "Server creation failed: " + error });
    }
});

manageRouter.delete("/delete", async (req: Request, res: Response) => {
    console.log("Deleting server");
    const { serverId } = req.body;
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    if (!serverId) {
        res.status(400).json({ message: "Server ID is required" });
        return;
    }
    try {
        await prisma.server.delete({
            where: { id: serverId }
        });
        res.status(200).json({ message: "Server deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: "Server deletion failed: " + error });
    }
});

manageRouter.put("/update", async (req: Request, res: Response) => {
    console.log("Updating server");
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { serverId, newServerName, newServerCredentials } = req.body as { serverId: string, newServerName: string, newServerCredentials: ServerCredentials };
    try {
        await prisma.server.update({
            where: { id: serverId },
            data: { credentials: JSON.stringify(newServerCredentials), name: newServerName }
        });
        res.status(200).json({ message: "Server updated successfully" });
    } catch (error) {
        res.status(400).json({ message: "Server update failed: " + error });
    }
});

export default manageRouter;