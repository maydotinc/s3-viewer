import {
   requireManagePermission,
   requireRevokePermission,
} from "@/lib/middleware/permissions";
import { prisma } from "@s3-viewer/db";
import { Role, ServerInvite } from "@s3-viewer/types";
import { Request, Response, Router } from "express";

const inviteRouter: Router = Router();

inviteRouter.get("/received", async (req: Request, res: Response) => {
   console.log("Getting received invites");
   try {
      const invites = await prisma.pendingInvitation.findMany({
         where: {
            email: req.user!.email,
         },
         select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            server: {
               select: {
                  name: true,
               },
            },
            invitedBy: {
               select: {
                  name: true,
                  email: true,
               },
            },
         },
         orderBy: {
            createdAt: "desc",
         },
      });
      const receivedInvites: ServerInvite[] = invites.map((invite) => ({
         id: invite.id,
         email: invite.email,
         role: invite.role as Role,
         expiresAt: invite.expiresAt.toISOString(),
         server: {
            name: invite.server.name,
         },
         invitedBy: {
            name: invite.invitedBy.name || "",
            email: invite.invitedBy.email,
         },
      }));
      res.status(200).json({ receivedInvites });
   } catch (error) {
      console.error("Error getting received invites:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

inviteRouter.get("/sent", async (req: Request, res: Response) => {
   console.log("Getting sent invites");
   try {
      const invites = await prisma.pendingInvitation.findMany({
         where: {
            invitedById: req.user!.id,
         },
         select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            server: {
               select: {
                  name: true,
               },
            },
            invitedBy: {
               select: {
                  name: true,
                  email: true,
               },
            },
         },
         orderBy: {
            createdAt: "desc",
         },
      });
      const sentInvites: ServerInvite[] = invites.map((invite) => ({
         id: invite.id,
         email: invite.email,
         role: invite.role as Role,
         expiresAt: invite.expiresAt.toISOString(),
         server: {
            name: invite.server.name,
         },
         invitedBy: {
            name: invite.invitedBy.name || "",
            email: invite.invitedBy.email,
         },
      }));
      res.status(200).json({ sentInvites });
   } catch (error) {
      console.error("Error getting sent invites:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

inviteRouter.post(
   "/send",
   requireManagePermission,
   async (req: Request, res: Response) => {
      console.log("Sending invite");
      const { serverId, emails, role, expiresAt } = req.body as {
         serverId: string;
         emails: string[];
         role: Role;
         expiresAt: string;
      };

      if (!emails || !role || !expiresAt) {
         res.status(400).json({
            message: "Emails, role and expiration date are required",
         });
         return;
      }
      const invitations = emails.map((email) => ({
         serverId,
         email,
         role,
         expiresAt: new Date(expiresAt),
         invitedById: req.user!.id,
      }));

      try {
         await prisma.pendingInvitation.createMany({
            data: invitations,
         });
         res.status(200).json({ message: "Invitations sent successfully" });
      } catch (error) {
         console.error("Error sending invitations:", error);
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

inviteRouter.post("/accept", async (req: Request, res: Response) => {
   console.log("Accepting invite");
   const { inviteId } = req.body;
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }

   try {
      await prisma.$transaction(async (tx) => {
         const invite = await tx.pendingInvitation.findFirst({
            where: {
               id: inviteId,
               email: req.user!.email,
               expiresAt: {
                  gt: new Date(),
               },
            },
         });

         if (!invite) {
            res.status(404).json({
               message: "Invite not found or has expired",
            });
            return;
         }

         await tx.serverAccess.create({
            data: {
               userId: req.user!.id,
               serverId: invite.serverId,
               role: invite.role,
            },
         });

         await tx.pendingInvitation.delete({
            where: { id: inviteId },
         });
      });

      res.status(200).json({ message: "Invite accepted successfully" });
   } catch (error) {
      console.error("Error accepting invite:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

inviteRouter.post("/reject", async (req: Request, res: Response) => {
   console.log("Rejecting invite");
   const { inviteId } = req.body;
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }

   try {
      await prisma.$transaction(async (tx) => {
         const invite = await tx.pendingInvitation.findFirst({
            where: {
               id: inviteId,
               email: req.user!.email,
            },
         });

         if (!invite) {
            res.status(404).json({
               message: "Invite not found",
            });
            return;
         }

         await tx.pendingInvitation.delete({
            where: { id: inviteId },
         });
      });

      res.status(200).json({ message: "Invite rejected successfully" });
   } catch (error) {
      console.error("Error rejecting invite:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

inviteRouter.delete(
   "/revoke",
   requireRevokePermission,
   async (req: Request, res: Response) => {
      console.log("Revoking invite");
      const { inviteId } = req.body;
      try {
         await prisma.pendingInvitation.delete({
            where: { id: inviteId },
         });

         res.status(200).json({ message: "Invite revoked successfully" });
      } catch (error) {
         console.error("Error revoking invite:", error);
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

inviteRouter.delete(
   "/delete-role",
   requireManagePermission,
   async (req: Request, res: Response) => {
      console.log("Deleting user role");
      const { serverId, userId } = req.body;
      try {
         await prisma.serverAccess.delete({
            where: { userId_serverId: { userId, serverId } },
         });
         res.status(200).json({ message: "User role deleted successfully" });
      } catch (error) {
         console.error("Error deleting user role:", error);
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

inviteRouter.put(
   "/update-role",
   requireManagePermission,
   async (req: Request, res: Response) => {
      console.log("Updating user role");
      const { role, serverId, userId } = req.body;
      try {
         await prisma.serverAccess.update({
            where: { userId_serverId: { userId, serverId } },
            data: { role },
         });
         res.status(200).json({ message: "User role updated successfully" });
      } catch (error) {
         console.error("Error updating user role:", error);
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

export default inviteRouter;
