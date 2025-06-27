import { prisma } from "@s3-viewer/db";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { NextFunction, Request, Response } from "express";

const requirePermissions = (
   permissions: Permission[],
   serverIdParam: string = "serverId"
) => {
   return async (req: Request, res: Response, next: NextFunction) => {
      try {
         console.log("Checking permissions for", permissions);
         const user = req.user;
         if (!user) {
            res.status(401).json({ message: "Authentication required" });
            return;
         }

         let serverId: string;
         if (req.body?.[serverIdParam]) {
            serverId = req.body[serverIdParam];
         } else if (req.query?.[serverIdParam]) {
            serverId = req.query[serverIdParam] as string;
         } else if (req.params?.[serverIdParam]) {
            serverId = req.params[serverIdParam];
         } else {
            res.status(400).json({ message: "Server ID is required" });
            return;
         }

         const serverAccess = await prisma.serverAccess.findUnique({
            where: {
               userId_serverId: { userId: user.id, serverId: serverId },
            },
            select: { role: true },
         });

         const userRole = (serverAccess?.role as Role) || null;

         if (!userRole) {
            res.status(403).json({
               message: "Access denied - no permissions for this server",
            });
            return;
         }

         if (!hasPermissions(userRole, permissions)) {
            res.status(403).json({
               message: "Insufficient permissions for this operation",
               required: permissions,
            });
            return;
         }

         req.userRole = userRole;
         next();
      } catch (error) {
         console.error("Permission check error:", error);
         res.status(500).json({ message: "Permission check failed" });
      }
   };
};

// Server management
const requireServerOwner = () => requirePermissions([Permission.DELETE_SERVER]);
const requireRenameServer = () =>
   requirePermissions([Permission.RENAME_SERVER]);

// Bucket management
const requireCreateBucket = () =>
   requirePermissions([Permission.CREATE_BUCKET]);
const requireDeleteBucket = () =>
   requirePermissions([Permission.DELETE_BUCKET]);
const requireListBuckets = () => requirePermissions([Permission.LIST_BUCKETS]);
const requireUploadObject = () =>
   requirePermissions([Permission.UPLOAD_OBJECT]);

// Object management
const requireDeleteObject = () =>
   requirePermissions([Permission.DELETE_OBJECT]);
const requireDownloadObject = () =>
   requirePermissions([Permission.DOWNLOAD_OBJECT]);
const requireListObjects = () => requirePermissions([Permission.LIST_OBJECTS]);
const requireMoveObject = () =>
   requirePermissions([Permission.UPLOAD_OBJECT, Permission.DELETE_OBJECT]);

export {
   requireCreateBucket,
   requireDeleteBucket,
   requireDeleteObject,
   requireDownloadObject,
   requireListBuckets,
   requireListObjects,
   requireMoveObject,
   requireRenameServer,
   requireServerOwner,
   requireUploadObject,
};
