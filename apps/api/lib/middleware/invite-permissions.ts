import { prisma } from "@s3-viewer/db";
import { hasPermissions, Permission } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { NextFunction, Request, Response } from "express";

const getManagePermissionForRole = (role: Role): Permission | null => {
   switch (role) {
      case Role.VIEWER:
         return Permission.MANAGE_VIEWER;
      case Role.EDITOR:
         return Permission.MANAGE_EDITOR;
      case Role.ADMIN:
         return Permission.MANAGE_ADMIN;
      case Role.OWNER:
         return null;
      default:
         return null;
   }
};

const requireInvitePermission = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const { role, serverId } = req.body;
   const user = req.user;

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
};

const requireRevokePermission = async (
   req: Request,
   res: Response,
   next: NextFunction
) => {
   const { inviteId, serverId } = req.body;
   const user = req.user;

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
      console.error("Permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
   }
};

export { requireInvitePermission, requireRevokePermission };
