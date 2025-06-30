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

// Object management
const requireUploadObject = () =>
   requirePermissions([Permission.UPLOAD_OBJECT]);
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
   requireManagePermission,
   requireMoveObject,
   requirePermissions,
   requireRenameServer,
   requireRevokePermission,
   requireServerOwner,
   requireUploadObject,
};
