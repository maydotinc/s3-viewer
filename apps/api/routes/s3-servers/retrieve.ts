import { prisma } from "@s3-viewer/db";
import { Role, ServerInfo, ServerUser } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import { requireListBuckets } from "../../lib/middleware/permissions.js";

const retrieveRouter: Router = Router();

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
         role: true,
         server: {
            select: {
               id: true,
               name: true,
               storageUsed: true,
            },
         },
      },
   });

   const serversList: ServerInfo[] = servers.map((server) => {
      return {
         ...server.server,
         userRole: server.role as Role,
      } as ServerInfo;
   });
   res.status(200).json({ serversList });
});

retrieveRouter.get(
   "/get-server-users",
   requireListBuckets(),
   async (req: Request, res: Response) => {
      console.log("Getting server users");
      const { serverId } = req.query as { serverId: string };

      const serverUsers = await prisma.serverAccess.findMany({
         where: {
            serverId: serverId,
         },
         select: {
            role: true,
            user: {
               select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
               },
            },
         },
      });
      const serverUsersList: ServerUser[] = serverUsers.map((user) => {
         return {
            ...user.user,
            role: user.role,
         } as ServerUser;
      });
      res.status(200).json({ serverUsers: serverUsersList });
   }
);

export default retrieveRouter;
