import {
   requireListBuckets,
   requireRenameServer,
   requireServerOwner,
} from "@/lib/middleware/permissions";
import detectProvider from "@/lib/utils/detect-provider";
import { decryptCredentials } from "@/lib/utils/encryption";
import { getS3ClientFromCredentials } from "@/lib/utils/s3-client";
import { validateBody } from "@/lib/middleware/validation";
import {
   HeadBucketCommand,
   ListBucketsCommand,
   S3ServiceException,
} from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   createServerSchema,
   establishSchema,
   renameServerSchema,
   serverIdBodySchema,
   validateBucketsSchema,
} from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";

const manageRouter: Router = Router();

const credentialCheckLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 10,
   standardHeaders: true,
   legacyHeaders: false,
   message: { error: "Too many requests, please try again later" },
});

manageRouter.post(
   "/establish",
   credentialCheckLimiter,
   validateBody(establishSchema),
   async (req: Request, res: Response) => {
      const { encryptedCredentials } = req.body;

      try {
         const credentials = decryptCredentials(encryptedCredentials);
         const s3Client = getS3ClientFromCredentials(credentials);

         const response = await s3Client.send(new ListBucketsCommand({}));
         if (response.Buckets) {
            res.status(200).json({
               message: "Server connection established successfully",
               listBucketsAllowed: true,
               bucketCount: response.Buckets.length,
               bucketNames: response.Buckets.map((b) => b.Name || ""),
            });
         } else {
            res.status(400).json({
               message:
                  "Server connection failed, are you sure you're using the correct credentials?",
            });
         }
      } catch (error: any) {
         console.error("Connection establishment failed:", error);

         if (
            error instanceof S3ServiceException &&
            (error.name === "AccessDenied" ||
               error.$metadata?.httpStatusCode === 403)
         ) {
            res.status(200).json({
               message:
                  "Credentials are valid but this token cannot list all buckets. Please enter bucket names manually.",
               listBucketsAllowed: false,
               bucketCount: 0,
               bucketNames: [],
            });
            return;
         }

         res.status(400).json({
            message:
               "Server connection failed, are you sure you're using the correct credentials?",
         });
      }
   }
);

manageRouter.post(
   "/validate-buckets",
   credentialCheckLimiter,
   validateBody(validateBucketsSchema),
   async (req: Request, res: Response) => {
      const { encryptedCredentials, bucketNames } = req.body;

      try {
         const credentials = decryptCredentials(encryptedCredentials);
         const s3Client = getS3ClientFromCredentials(credentials);

         const results: { bucketName: string; accessible: boolean }[] = [];

         for (const bucketName of bucketNames) {
            try {
               await s3Client.send(
                  new HeadBucketCommand({ Bucket: bucketName })
               );
               results.push({ bucketName, accessible: true });
            } catch (err: any) {
               results.push({ bucketName, accessible: false });
            }
         }

         const accessible = results.filter((r) => r.accessible);
         const inaccessible = results.filter((r) => !r.accessible);

         res.status(200).json({
            results,
            accessibleCount: accessible.length,
            inaccessibleBuckets: inaccessible.map((r) => r.bucketName),
         });
      } catch (error) {
         console.error("Bucket validation failed:", error);
         res.status(400).json({
            message: "Failed to validate bucket access",
         });
      }
   }
);

manageRouter.post(
   "/create",
   validateBody(createServerSchema),
   async (req: Request, res: Response) => {
      const { encryptedCredentials, serverName, bucketNames } = req.body;

      try {
         const credentials = decryptCredentials(encryptedCredentials);
         const provider = detectProvider(credentials);

         const server = await prisma.server.create({
            data: {
               credentials: encryptedCredentials,
               name: serverName,
               ownerId: req.user!.id,
               provider,
               allowedBuckets: bucketNames ?? [],
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
         res.status(400).json({ message: "Server creation failed" });
      }
   }
);

manageRouter.delete(
   "/disconnect",
   validateBody(serverIdBodySchema),
   requireListBuckets(),
   async (req: Request, res: Response) => {
      const { serverId } = req.body;

      try {
         await prisma.$transaction([
            prisma.bucketAccess.deleteMany({
               where: { userId: req.user!.id, serverId },
            }),
            prisma.serverAccess.delete({
               where: { userId_serverId: { userId: req.user!.id, serverId } },
            }),
         ]);
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
   validateBody(serverIdBodySchema),
   requireServerOwner(),
   async (req: Request, res: Response) => {
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
   validateBody(renameServerSchema),
   requireRenameServer(),
   async (req: Request, res: Response) => {
      const { serverId, serverName } = req.body;

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
