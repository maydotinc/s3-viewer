import {
   requireManagePermission,
   requireRevokePermission,
} from "@/lib/middleware/permissions";
import { prisma } from "@s3-viewer/db";
import { sendServerInviteEmail } from "@s3-viewer/email";
import { maxRole } from "@s3-viewer/permissions";
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

      if (
         !Array.isArray(emails) ||
         emails.length === 0 ||
         !role ||
         !expiresAt
      ) {
         res.status(400).json({
            message: "Emails, role and expiration date are required",
         });
         return;
      }

      const normalizedEmails = emails
         .map((email) => email?.trim().toLowerCase())
         .filter((email): email is string => Boolean(email));
      const uniqueEmails = Array.from(new Set(normalizedEmails));

      if (uniqueEmails.length === 0) {
         res.status(400).json({
            message: "At least one valid email is required",
         });
         return;
      }

      if (uniqueEmails.length > 5) {
         res.status(400).json({
            message: "You can only invite up to 5 users at a time",
         });
         return;
      }

      const numberOfExistingServerUsers = await prisma.serverAccess.count({
         where: {
            serverId,
         },
      });

      if (numberOfExistingServerUsers >= 10) {
         res.status(400).json({
            message: "Server already has the maximum number (10) of users",
         });
         return;
      } else if (numberOfExistingServerUsers + uniqueEmails.length > 10) {
         res.status(400).json({
            message:
               "Server would exceed the maximum number (10) of users by " +
               (numberOfExistingServerUsers + uniqueEmails.length - 10),
         });
         return;
      }

      const expiresAtDate = new Date(expiresAt);
      const invitations = uniqueEmails.map((email) => ({
         serverId,
         email,
         role,
         expiresAt: expiresAtDate,
         invitedById: req.user!.id,
      }));

      try {
         const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { name: true },
         });

         await prisma.pendingInvitation.createMany({
            data: invitations,
            skipDuplicates: true,
         });

         const frontendUrl =
            process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
         const invitesUrl = (() => {
            if (!frontendUrl) return "/invites";
            try {
               return new URL("/invites", frontendUrl).toString();
            } catch {
               return `${frontendUrl.replace(/\/$/, "")}/invites`;
            }
         })();

         const results = await Promise.allSettled(
            uniqueEmails.map((email) =>
               sendServerInviteEmail({
                  to: email,
                  serverName: server?.name ?? "a server",
                  role,
                  invitedByEmail: req.user!.email,
                  invitedByName: req.user!.name || undefined,
                  expiresAt: expiresAtDate,
                  invitesUrl,
               })
            )
         );

         const failures = results.filter((r) => r.status === "rejected");
         if (failures.length > 0) {
            console.warn(
               `Invite emails: ${failures.length}/${results.length} failed to send`
            );
         }

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
      const result = await prisma.$transaction(async (tx) => {
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
            return {
               status: 404 as const,
               body: { message: "Invite not found or has expired" },
            };
         }

         const existingAccess = await tx.serverAccess.findUnique({
            where: {
               userId_serverId: {
                  userId: req.user!.id,
                  serverId: invite.serverId,
               },
            },
            select: { id: true, role: true },
         });
         if (existingAccess) {
            const existingRole = existingAccess.role as Role;
            const invitedRole = invite.role as Role;
            const nextRole = maxRole(existingRole, invitedRole);
            if (nextRole !== existingRole) {
               await tx.serverAccess.update({
                  where: {
                     userId_serverId: {
                        userId: req.user!.id,
                        serverId: invite.serverId,
                     },
                  },
                  data: {
                     role: nextRole,
                  },
               });
            }
            await tx.pendingInvitation.delete({ where: { id: inviteId } });
            return {
               status: 200 as const,
               body: { message: "Invite accepted successfully" },
            };
         }

         // Serialize accepts per-server to enforce the cap under concurrency.
         await tx.$executeRaw`
            SELECT 1 FROM "server"
            WHERE id = ${invite.serverId}
            FOR UPDATE
         `;

         const numberOfExistingServerUsers = await tx.serverAccess.count({
            where: { serverId: invite.serverId },
         });
         if (numberOfExistingServerUsers >= 10) {
            return {
               status: 400 as const,
               body: {
                  message:
                     "Server already has the maximum number (10) of users",
               },
            };
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
         return {
            status: 200 as const,
            body: { message: "Invite accepted successfully" },
         };
      });

      res.status(result.status).json(result.body);
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
      const result = await prisma.$transaction(async (tx) => {
         const invite = await tx.pendingInvitation.findFirst({
            where: {
               id: inviteId,
               email: req.user!.email,
            },
         });

         if (!invite) {
            return {
               status: 404 as const,
               body: { message: "Invite not found" },
            };
         }

         await tx.pendingInvitation.delete({
            where: { id: inviteId },
         });
         return {
            status: 200 as const,
            body: { message: "Invite rejected successfully" },
         };
      });

      res.status(result.status).json(result.body);
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
