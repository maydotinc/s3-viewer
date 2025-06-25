import hasPermissions from "@/lib/utils/permission.js";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { Role, ServerCredentials } from "@s3-viewer/types";
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
            message: "Server connection failed, are you sure you're using the correct credentials?",
         });
      }
   } catch (error) {
      res.status(400).json({
         message: "Server connection failed, are you sure you're using the correct credentials?",
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
      res.status(200).json({ message: "Server created successfully", serverId: server.id });
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
   } catch (error) {
      res.status(400).json({ message: "Server deletion failed: " + error });
   }
});

manageRouter.put("/rename", async (req: Request, res: Response) => {
   console.log("Renaming server");
   const { serverId, serverName } = req.body as { serverId: string; serverName: string };
   if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!serverId || !serverName) {
      res.status(400).json({ message: "Server ID and server name are required" });
      return;
   }
   if (!(await hasPermissions(serverId, req.user.id, [Role.OWNER, Role.ADMIN]))) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   try {
      await prisma.server.update({
         where: { id: serverId },
         data: { name: serverName },
      });
      res.status(200).json({ message: "Server renamed successfully" });
   } catch (error) {
      res.status(400).json({ message: "Server renaming failed: " + error });
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
         include: {
            server: {
               select: {
                  id: true,
                  name: true,
               },
            },
            invitedBy: {
               select: {
                  id: true,
                  name: true,
                  email: true,
               },
            },
         },
         orderBy: {
            createdAt: "desc",
         },
      });

      res.status(200).json({ invites });
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
         include: {
            server: {
               select: {
                  id: true,
                  name: true,
               },
            },
         },
         orderBy: {
            createdAt: "desc",
         },
      });

      res.status(200).json({ invites });
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
      // Find the invite and verify it belongs to the user
      const invite = await prisma.pendingInvitation.findFirst({
         where: {
            id: inviteId,
            email: req.user.email,
            accepted: false,
         },
      });

      if (!invite) {
         res.status(404).json({ message: "Invite not found or already accepted" });
         return;
      }

      // Check if invite has expired
      if (new Date() > invite.expiresAt) {
         res.status(400).json({ message: "Invite has expired" });
         return;
      }

      // Check if user already has access to this server
      const existingAccess = await prisma.serverAccess.findFirst({
         where: {
            userId: req.user.id,
            serverId: invite.serverId,
         },
      });

      if (existingAccess) {
         // Mark invite as accepted even if user already has access
         await prisma.pendingInvitation.update({
            where: { id: inviteId },
            data: { accepted: true },
         });
         res.status(400).json({ message: "You already have access to this server" });
         return;
      }

      // Start transaction to accept invite and create server access
      await prisma.$transaction(async (tx) => {
         // Mark invite as accepted
         await tx.pendingInvitation.update({
            where: { id: inviteId },
            data: { accepted: true },
         });

         // Create server access
         await tx.serverAccess.create({
            data: {
               userId: req.user!.id,
               serverId: invite.serverId,
               role: invite.role,
            },
         });
      });

      res.status(200).json({ message: "Invite accepted successfully" });
   } catch (error) {
      console.error("Error accepting invite:", error);
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
      // Find the invite and verify it was sent by the user
      const invite = await prisma.pendingInvitation.findFirst({
         where: {
            id: inviteId,
            invitedById: req.user.id,
            accepted: false,
         },
      });

      if (!invite) {
         res.status(404).json({ message: "Invite not found or already accepted" });
         return;
      }

      // Delete the invite
      await prisma.pendingInvitation.delete({
         where: { id: inviteId },
      });

      res.status(200).json({ message: "Invite revoked successfully" });
   } catch (error) {
      console.error("Error revoking invite:", error);
      res.status(500).json({ message: "Internal server error" });
   }
});

manageRouter.post("/invites/send", async (req: Request, res: Response) => {
   console.log("Sending server invitation");
   const { serverId, emails, role, expiresAt } = req.body as {
      serverId: string;
      emails: string[];
      role: Role;
      expiresAt: Date;
   };
   const userId = req.user?.id;
   if (!req.user || !userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   if (!serverId || !emails || !role || !expiresAt) {
      res.status(400).json({ message: "Server ID, emails, role and expiration date are required" });
      return;
   }
   if (!(await hasPermissions(serverId, userId, [Role.OWNER, Role.ADMIN])) || role === Role.OWNER) {
      res.status(401).json({ message: "Unauthorized" });
      return;
   }
   const invitations = emails.map((email) => ({
      email,
      serverId,
      role,
      expiresAt: expiresAt,
      invitedById: userId,
   }));
   try {
      await prisma.pendingInvitation.createMany({
         data: invitations,
         skipDuplicates: true,
      });
      // FOR PROD: Send email to invited users
      res.status(200).json({ message: "Invitation(s) sent successfully" });
   } catch (error) {
      res.status(400).json({ message: "Invitation sending failed: " + error });
   }
});

export default manageRouter;
