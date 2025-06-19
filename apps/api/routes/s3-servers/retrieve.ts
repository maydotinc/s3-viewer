import { prisma } from "@s3-viewer/db";
import { ServerInfo } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import authGuard from "../../lib/utils/auth.js";

const retrieveRouter: Router = Router();
retrieveRouter.use(authGuard);

retrieveRouter.get("/get-servers", async (req: Request, res: Response) => {
   console.log("Getting servers");
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }

   const servers = await prisma.serverAccess.findMany({
      where: {
         userId: req.user.id,
      },
      select: {
         server: {
            select: {
               id: true,
               name: true,
               storageUsed: true,
            },
         },
      },
   });

   const serversList: ServerInfo[] = servers.map((server) => server.server as ServerInfo);
   res.status(200).json({ serversList });
});

retrieveRouter.get("/get-server-name", async (req: Request, res: Response) => {
   console.log("Getting server name");
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }

   const { serverId } = req.query as { serverId: string };
   const serverName = await prisma.server.findUnique({
      where: {
         id: serverId,
      },
      select: {
         name: true,
      },
   });
   res.status(200).json({ serverName });
});

export default retrieveRouter;
