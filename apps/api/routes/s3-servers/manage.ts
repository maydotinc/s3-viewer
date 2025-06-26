import hasPermissions from "@/lib/utils/permission.js";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { Role, ServerCredentials, ServerInvite } from "@s3-viewer/types";
import { Request, Response, Router } from "express";
import { getS3ClientFromCredentials } from "../../lib/s3.js";
import authGuard from "../../lib/utils/auth.js";

const manageRouter: Router = Router();
manageRouter.use(authGuard);

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

manageRouter.delete("/delete", async (req: Request, res: Response) => {
   console.log("Deleting server");
   const { serverId } = req.body;
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!serverId) {
      res.status(400).json({ message: "Server ID is required" });
      return;
   }
   if (!(await hasPermissions(serverId, req.user.id, [Role.OWNER]))) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
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
});

manageRouter.put("/rename", async (req: Request, res: Response) => {
   console.log("Renaming server");
   const { serverId, serverName } = req.body as {
      serverId: string;
      serverName: string;
   };
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!serverId || !serverName) {
      res.status(400).json({
         message: "Server ID and server name are required",
      });
      return;
   }
   if (
      !(await hasPermissions(serverId, req.user.id, [Role.OWNER, Role.ADMIN]))
   ) {
      res.status(401).json({ message: "Unauthorized" });
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
         }
      }
      res.status(500).json({ message: "Internal server error" });
   }
});

//====INVITES AND SHARING====//
manageRouter.get("/invites/received", async (req: Request, res: Response) => {
   console.log("Getting received invites");
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   try {
      const invites = await prisma.pendingInvitation.findMany({
         where: {
            email: req.user.email,
            accepted: false,
         },
         select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            accepted: true,
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
         accepted: invite.accepted,
         server: {
            name: invite.server.name,
         },
         invitedBy: {
            name: invite.invitedBy.name,
            email: invite.invitedBy.email,
         },
      }));
      res.status(200).json({ receivedInvites });
   } catch (error) {
      console.error("Error fetching received invites:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.get("/invites/sent", async (req: Request, res: Response) => {
   console.log("Getting sent invites");
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   try {
      const invites = await prisma.pendingInvitation.findMany({
         where: {
            invitedById: req.user.id,
         },
         select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            accepted: true,
            invitedBy: {
               select: {
                  name: true,
                  email: true,
               },
            },
            server: {
               select: {
                  name: true,
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
         accepted: invite.accepted,
         server: {
            name: invite.server.name,
         },
         invitedBy: {
            name: invite.invitedBy.name,
            email: invite.invitedBy.email,
         },
      }));
      res.status(200).json({ sentInvites });
   } catch (error) {
      console.error("Error fetching sent invites:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.post("/invites/accept", async (req: Request, res: Response) => {
   console.log("Accepting invite");
   const { inviteId } = req.body;
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }
   try {
      const invite = await prisma.pendingInvitation.findUnique({
         where: {
            id: inviteId,
            accepted: false,
         },
      });
      if (!invite) {
         res.status(404).json({
            message: "Invite not found or already accepted",
         });
         return;
      }
      if (new Date() > invite.expiresAt) {
         res.status(400).json({ message: "Invite has expired" });
         return;
      }
      const existingAccess = await prisma.serverAccess.findFirst({
         where: {
            userId: req.user.id,
            serverId: invite.serverId,
         },
      });
      if (existingAccess) {
         await prisma.pendingInvitation.update({
            where: { id: inviteId },
            data: { accepted: true },
         });
         res.status(400).json({
            message: "You already have access to this server",
         });
         return;
      }

      await prisma.$transaction(async (tx) => {
         await tx.pendingInvitation.update({
            where: { id: inviteId },
            data: { accepted: true },
         });
         await tx.serverAccess.create({
            data: {
               userId: req.user!.id,
               serverId: invite.serverId,
               role: invite.role,
            },
         });
      });

      res.status(200).json({ message: "Invite accepted successfully" });
   } catch (error: any) {
      console.error("Error accepting invite:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === "P2025") {
            res.status(404).json({
               message: "Invite not found or already accepted",
            });
            return;
         }
      }
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.delete("/invites/revoke", async (req: Request, res: Response) => {
   console.log("Revoking invite");
   const { inviteId } = req.body;
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }
   try {
      await prisma.pendingInvitation.delete({
         where: {
            id: inviteId,
            invitedById: req.user.id,
            accepted: false,
         },
      });
      res.status(200).json({ message: "Invite revoked successfully" });
   } catch (error: any) {
      console.error("Error revoking invite:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === "P2025") {
            res.status(404).json({
               message: "Invite not found or already processed",
            });
            return;
         }
      }
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.post("/invites/send", async (req: Request, res: Response) => {
   console.log("Sending server invitation");
   const { serverId, emails, role, expiresAt } = req.body as {
      serverId: string;
      emails: string[];
      role: Role;
      expiresAt: string;
   };
   const userId = req.user?.id;
   if (!req.user || !userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!serverId || !emails || !role || !expiresAt) {
      res.status(400).json({
         message: "Server ID, emails, role and expiration date are required",
      });
      return;
   }
   if (
      !(await hasPermissions(serverId, userId, [Role.OWNER, Role.ADMIN])) ||
      role === Role.OWNER
   ) {
      res.status(401).json({
         message: "You do not have permission to send server invitations",
      });
      return;
   }
   const invitations = emails.map((email) => ({
      email,
      serverId,
      role,
      expiresAt: new Date(expiresAt),
      invitedById: userId,
   }));
   try {
      await prisma.pendingInvitation.createMany({
         data: invitations,
         skipDuplicates: true,
      });
      // FOR PROD: Send email to invited users
      res.status(200).json({ message: "Invitation(s) sent successfully" });
   } catch (error: any) {
      console.error("Error sending invitations:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === "P2002") {
            res.status(409).json({
               message: "Invitation already exists for one or more recipients",
            });
            return;
         }
      }
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.post("/invites/reject", async (req: Request, res: Response) => {
   console.log("Rejecting invite");
   const { inviteId } = req.body;
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!inviteId) {
      res.status(400).json({ message: "Invite ID is required" });
      return;
   }
   try {
      await prisma.pendingInvitation.delete({
         where: {
            id: inviteId,
            email: req.user.email,
            accepted: false,
         },
      });
      res.status(200).json({ message: "Invite rejected successfully" });
   } catch (error: any) {
      console.error("Error rejecting invite:", error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === "P2025") {
            res.status(404).json({
               message: "Invite not found or already processed",
            });
            return;
         }
      }
      res.status(500).json({ message: "Internal server error" });
   }
});

export default manageRouter;
