import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { ServerCredentials } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import {
   requireRenameServer,
   requireServerOwner,
} from "../../lib/middleware/permissions.js";
import { getS3ClientFromCredentials } from "../../lib/s3.js";

const manageRouter: Router = Router();

manageRouter.post("/establish", async (req: Request, res: Response) => {
   console.log("Establishing connection");
   const credentials = req.body as ServerCredentials;
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!credentials) {
      res.status(400).json({ message: "Server credentials are required" });
      return;
   }
   const s3Client = getS3ClientFromCredentials(credentials);
   try {
      const response = await s3Client.send(new ListBucketsCommand({}));
      if (response.Buckets) {
         res.status(200).json({
            message: "Server connected established successfully",
            bucketCount: response.Buckets?.length,
         });
      } else {
         res.status(400).json({
            message:
               "Server connection failed, are you sure you're using the correct credentials?",
         });
      }
   } catch (error) {
      res.status(400).json({
         message:
            "Server connection failed, are you sure you're using the correct credentials?",
      });
   }
});

manageRouter.post("/create", async (req: Request, res: Response) => {
   console.log("Creating server");
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   const { serverCredentials, serverName } = req.body as {
      serverCredentials: ServerCredentials;
      serverName: string;
   };

   try {
      const server = await prisma.server.create({
         data: {
            credentials: JSON.stringify(serverCredentials),
            name: serverName,
            ownerId: req.user.id,
            serverAccess: {
               create: {
                  userId: req.user.id,
                  role: "OWNER",
               },
            },
         },
      });
      res.status(200).json({
         message: "Server created successfully",
         serverId: server.id,
      });
   } catch (error) {
      res.status(400).json({ message: "Server creation failed: " + error });
   }
});

manageRouter.delete(
   "/delete",
   requireServerOwner(),
   async (req: Request, res: Response) => {
      console.log("Deleting server");
      const { serverId } = req.body;

      try {
         await prisma.server.delete({
            where: { id: serverId },
         });
         res.status(200).json({ message: "Server deleted successfully" });
      } catch (error: any) {
         console.error("Error deleting server:", error);
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2025") {
               res.status(404).json({
                  message: "Server not found",
               });
               return;
            }
         }
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

manageRouter.put(
   "/rename",
   requireRenameServer(),
   async (req: Request, res: Response) => {
      console.log("Renaming server");
      const { serverId, serverName } = req.body as {
         serverId: string;
         serverName: string;
      };

      if (!serverName) {
         res.status(400).json({
            message: "Server name is required",
         });
         return;
      }

      try {
         await prisma.server.update({
            where: { id: serverId },
            data: { name: serverName },
         });
         res.status(200).json({ message: "Server renamed successfully" });
      } catch (error: any) {
         console.error("Error renaming server:", error);
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2025") {
               res.status(404).json({
                  message: "Server not found",
               });
               return;
            } else if (error.code === "P2002") {
               res.status(400).json({
                  message: "A server with this name already exists",
               });
               return;
            }
         }
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

export default manageRouter;
