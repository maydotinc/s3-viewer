import { prisma } from "@s3-viewer/db";
import {
   getManagePermissionForRole,
   hasPermissions,
   Permission,
} from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { NextFunction, Request, Response } from "express";

// Core permission checking function
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
         const serverId =
            req.body?.serverId || req.query?.serverId || req.params?.serverId;
         if (!serverId) {
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

// User management permissions
const requireManagePermission = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const user = req.user;
   const role = req.body?.role || req.query?.role || req.params?.role;
   const serverId =
      req.body?.serverId || req.query?.serverId || req.params?.serverId;
   if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
   }
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (role === Role.OWNER) {
      res.status(400).json({ message: "Cannot invite users as owner" });
      return;
   }
   const requiredPermission = getManagePermissionForRole(role);
   if (!requiredPermission) {
      res.status(400).json({ message: "Invalid role" });
      return;
   }
   try {
      const serverAccess = await prisma.serverAccess.findUnique({
         where: { userId_serverId: { userId: user.id, serverId } },
         select: { role: true },
      });

      const userRole = serverAccess?.role as Role;
      if (!userRole) {
         res.status(403).json({
            message: "Access denied - no permissions for this server",
         });
         return;
      }

      if (!hasPermissions(userRole, [requiredPermission])) {
         res.status(403).json({
            message: `Insufficient permissions to manage ${role.toLowerCase()} users`,
            required: requiredPermission,
         });
         return;
      }

      req.userRole = userRole;
      next();
   } catch (error) {
      console.error("Manage permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
   }
};

// Revoking invite permissions (some extra checks and steps)
const requireRevokePermission = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const user = req.user;
   const inviteId =
      req.body?.inviteId || req.query?.inviteId || req.params?.inviteId;
   const serverId =
      req.body?.serverId || req.query?.serverId || req.params?.serverId;
   if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
   }
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }
   try {
      const invite = await prisma.pendingInvitation.findUnique({
         where: { id: inviteId },
         select: { role: true, serverId: true },
      });

      if (!invite) {
         res.status(404).json({ message: "Invite not found" });
         return;
      }

      const targetRole = invite.role as Role;
      const requiredPermission = getManagePermissionForRole(targetRole);

      if (!requiredPermission) {
         res.status(400).json({ message: "Cannot revoke this invite" });
         return;
      }

      const serverIdToCheck = serverId || invite.serverId;

      const serverAccess = await prisma.serverAccess.findUnique({
         where: {
            userId_serverId: { userId: user.id, serverId: serverIdToCheck },
         },
         select: { role: true },
      });

      const userRole = serverAccess?.role as Role;
      if (!userRole) {
         res.status(403).json({
            message: "Access denied - no permissions for this server",
         });
         return;
      }

      if (!hasPermissions(userRole, [requiredPermission])) {
         res.status(403).json({
            message: `Insufficient permissions to revoke ${targetRole.toLowerCase()} invites`,
            required: requiredPermission,
         });
         return;
      }

      req.userRole = userRole;
      next();
   } catch (error) {
      console.error("Revoke invite permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
   }
};

// Bucket-level permission checking for non-owner users.
// Owners bypass bucket-level checks; non-owners need a BucketAccess row
// whose role grants the required permissions.
const requireBucketPermissions = (
   permissions: Permission[],
   bucketNameParam: string = "bucketName"
) => {
   return async (req: Request, res: Response, next: NextFunction) => {
      try {
         const user = req.user;
         if (!user) {
            res.status(401).json({ message: "Authentication required" });
            return;
         }
         const serverId =
            req.body?.serverId || req.query?.serverId || req.params?.serverId;
         if (!serverId) {
            res.status(400).json({ message: "Server ID is required" });
            return;
         }

         const bucketName =
            req.body?.[bucketNameParam] ||
            req.query?.[bucketNameParam] ||
            req.params?.[bucketNameParam];
         if (!bucketName) {
            res.status(400).json({ message: "Bucket name is required" });
            return;
         }

         // First check server-level access
         const serverAccess = await prisma.serverAccess.findUnique({
            where: {
               userId_serverId: { userId: user.id, serverId },
            },
            select: { role: true },
         });

         const serverRole = (serverAccess?.role as Role) || null;
         if (!serverRole) {
            res.status(403).json({
               message: "Access denied - no permissions for this server",
            });
            return;
         }

         // Owners bypass bucket-level checks
         if (serverRole === Role.OWNER) {
            req.userRole = serverRole;
            next();
            return;
         }

         // Non-owners: check bucket-level access
         const bucketAccess = await prisma.bucketAccess.findUnique({
            where: {
               userId_serverId_bucketName: {
                  userId: user.id,
                  serverId,
                  bucketName,
               },
            },
            select: { role: true },
         });

         if (!bucketAccess) {
            res.status(403).json({
               message: "Access denied - no permissions for this bucket",
            });
            return;
         }

         const bucketRole = bucketAccess.role as Role;
         if (!hasPermissions(bucketRole, permissions)) {
            res.status(403).json({
               message: "Insufficient permissions for this bucket operation",
               required: permissions,
            });
            return;
         }

         req.userRole = bucketRole;
         next();
      } catch (error) {
         console.error("Bucket permission check error:", error);
         res.status(500).json({ message: "Permission check failed" });
      }
   };
};

// Server management
const requireServerOwner = () => requirePermissions([Permission.DELETE_SERVER]);
const requireRenameServer = () =>
   requirePermissions([Permission.RENAME_SERVER]);

// Bucket management (server-level for listing, bucket-level for create/delete)
const requireCreateBucket = () =>
   requirePermissions([Permission.CREATE_BUCKET]);
const requireDeleteBucket = () =>
   requirePermissions([Permission.DELETE_BUCKET]);
const requireListBuckets = () => requirePermissions([Permission.LIST_BUCKETS]);

// Object management (bucket-level)
const requireUploadObject = () =>
   requireBucketPermissions([Permission.UPLOAD_OBJECT]);
const requireDeleteObject = () =>
   requireBucketPermissions([Permission.DELETE_OBJECT]);
const requireDownloadObject = () =>
   requireBucketPermissions([Permission.DOWNLOAD_OBJECT]);
const requireListObjects = () =>
   requireBucketPermissions([Permission.LIST_OBJECTS], "bucket");
const requireMoveObject = () =>
   requireBucketPermissions([Permission.UPLOAD_OBJECT, Permission.DELETE_OBJECT], "sourceBucket");

export {
   requireBucketPermissions,
   requireCreateBucket,
   requireDeleteBucket,
   requireDeleteObject,
   requireDownloadObject,
   requireListBuckets,
   requireListObjects,
   requireManagePermission,
   requireMoveObject,
   requirePermissions,
   requireRenameServer,
   requireRevokePermission,
   requireServerOwner,
   requireUploadObject,
};
