import { prisma } from "@s3-viewer/db";
import { Request, Response, Router } from "express";
import { testServerConnection } from "../utils/servers.js";
import { getUserId } from "../utils/session.js";

const connectRouter: Router = Router();

connectRouter.post("/", async (req: Request, res: Response) => {
    const userId = await getUserId(req);
    if (!userId) {
        res.status(401).json({ message: "Unauthorized, please login to continue" });
        return;
    }
    const { serverCredentials, serverName } = req.body;
    const isConnected = await testServerConnection(serverCredentials);
    if (isConnected) {
        if (serverName) {
            await prisma.server.create({
                data: {
                    credentials: JSON.stringify(serverCredentials),
                    name: serverName,
                    ownerId: userId,
                },
            });
        } else {
            await prisma.server.create({
                data: {
                    credentials: JSON.stringify(serverCredentials),
                    ownerId: userId,
                },
            });
        }
        res.status(200).json({ message: "Server connected successfully" });
    } else {
        res.status(400).json({ message: "Server connection failed, are you sure you're using the correct credentials?" });
    }
});

export default connectRouter;