import detectProvider from "@/lib/utils/detect-provider.js";
import { decryptCredentials } from "@/lib/utils/encryption.js";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { Request, Response, Router } from "express";
import {
   requireListBuckets,
   requireRenameServer,
   requireServerOwner,
} from "../../lib/middleware/permissions.js";
import { getS3ClientFromCredentials } from "../../lib/utils/s3-client.js";

const manageRouter: Router = Router();

manageRouter.post("/establish", async (req: Request, res: Response) => {
   console.log("Establishing connection");
   const { encryptedCredentials } = req.body as {
      encryptedCredentials: string;
   };

   if (!encryptedCredentials) {
      res.status(400).json({
         message: "Encrypted server credentials are required",
      });
      return;
   }

   try {
      const credentials = decryptCredentials(encryptedCredentials);
      const s3Client = getS3ClientFromCredentials(credentials);

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
      console.error("Connection establishment failed:", error);
      res.status(400).json({
         message:
            "Server connection failed, are you sure you're using the correct credentials?",
      });
   }
});

manageRouter.post("/create", async (req: Request, res: Response) => {
   console.log("Creating server");
   const { encryptedCredentials, serverName } = req.body as {
      encryptedCredentials: string;
      serverName: string;
   };

   if (!encryptedCredentials || !serverName) {
      res.status(400).json({
         message: "Encrypted credentials and server name are required",
      });
      return;
   }

   try {
      const credentials = decryptCredentials(encryptedCredentials);
      const provider = detectProvider(credentials);

      const server = await prisma.server.create({
         data: {
            credentials: encryptedCredentials,
            name: serverName,
            ownerId: req.user!.id,
            provider,
            serverAccess: {
               create: {
                  userId: req.user!.id,
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
      console.error("Server creation failed:", error);
      res.status(400).json({ message: "Server creation failed: " + error });
   }
});

manageRouter.delete(
   "/disconnect",
   requireListBuckets(),
   async (req: Request, res: Response) => {
      console.log("Disconnecting from server");
      const { serverId } = req.body;

      try {
         await prisma.serverAccess.delete({
            where: { userId_serverId: { userId: req.user!.id, serverId } },
         });
         res.status(200).json({
            message: "Disconnected from server",
         });
      } catch (error) {
         console.error("Error disconnecting from server:", error);
         if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2025") {
               res.status(404).json({
                  message: "Server not found",
               });
               return;
            }
         }
         res.status(400).json({ message: "Disconnection failed: " + error });
      }
   }
);

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
