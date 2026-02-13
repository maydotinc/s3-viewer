import {
   requireManagePermission,
   requireRevokePermission,
} from "@/lib/middleware/permissions";
import { prisma } from "@s3-viewer/db";
import { sendServerInviteEmail } from "@s3-viewer/email";
import { maxRole } from "@s3-viewer/permissions";
import { BucketAccessEntry, Role, ServerInvite } from "@s3-viewer/types";
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
            bucketAccess: {
               select: {
                  bucketName: true,
                  role: true,
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
         bucketAccess: invite.bucketAccess.map((ba) => ({
            bucketName: ba.bucketName,
            role: ba.role as Role,
         })),
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
            bucketAccess: {
               select: {
                  bucketName: true,
                  role: true,
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
         bucketAccess: invite.bucketAccess.map((ba) => ({
            bucketName: ba.bucketName,
            role: ba.role as Role,
         })),
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
      const { serverId, emails, role, expiresAt, bucketAccess } = req.body as {
         serverId: string;
         emails: string[];
         role: Role;
         expiresAt: string;
         bucketAccess: BucketAccessEntry[];
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

      if (!Array.isArray(bucketAccess) || bucketAccess.length === 0) {
         res.status(400).json({
            message: "At least one bucket must be selected for the invite",
         });
         return;
      }

      // Validate bucket access entries
      const validRoles = Object.values(Role);
      const seenBuckets = new Set<string>();
      for (const entry of bucketAccess) {
         if (!entry.bucketName || typeof entry.bucketName !== "string") {
            res.status(400).json({
               message: "Each bucket access entry must have a bucketName",
            });
            return;
         }
         if (!entry.role || !validRoles.includes(entry.role)) {
            res.status(400).json({
               message: `Invalid role for bucket ${entry.bucketName}`,
            });
            return;
         }
         if (entry.role === Role.OWNER) {
            res.status(400).json({
               message: "Cannot assign OWNER role to a bucket",
            });
            return;
         }
         if (seenBuckets.has(entry.bucketName)) {
            res.status(400).json({
               message: `Duplicate bucket entry: ${entry.bucketName}`,
            });
            return;
         }
         seenBuckets.add(entry.bucketName);
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

      try {
         const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { name: true },
         });

         // Create invitations with bucket access in a transaction
         await prisma.$transaction(async (tx) => {
            for (const email of uniqueEmails) {
               const invitation = await tx.pendingInvitation.upsert({
                  where: { email_serverId: { email, serverId } },
                  update: {
                     role,
                     expiresAt: expiresAtDate,
                     invitedById: req.user!.id,
                  },
                  create: {
                     serverId,
                     email,
                     role,
                     expiresAt: expiresAtDate,
                     invitedById: req.user!.id,
                  },
               });

               // Remove old bucket access entries and create new ones
               await tx.invitationBucketAccess.deleteMany({
                  where: { invitationId: invitation.id },
               });

               await tx.invitationBucketAccess.createMany({
                  data: bucketAccess.map((ba) => ({
                     invitationId: invitation.id,
                     bucketName: ba.bucketName,
                     role: ba.role,
                  })),
               });
            }
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
            include: {
               bucketAccess: true,
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

            // Merge bucket access: upsert each bucket entry with the higher role
            for (const ba of invite.bucketAccess) {
               const existing = await tx.bucketAccess.findUnique({
                  where: {
                     userId_serverId_bucketName: {
                        userId: req.user!.id,
                        serverId: invite.serverId,
                        bucketName: ba.bucketName,
                     },
                  },
               });
               const newRole = existing
                  ? maxRole(existing.role as Role, ba.role as Role)
                  : (ba.role as Role);
               await tx.bucketAccess.upsert({
                  where: {
                     userId_serverId_bucketName: {
                        userId: req.user!.id,
                        serverId: invite.serverId,
                        bucketName: ba.bucketName,
                     },
                  },
                  update: { role: newRole },
                  create: {
                     userId: req.user!.id,
                     serverId: invite.serverId,
                     bucketName: ba.bucketName,
                     role: newRole,
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

         // Create bucket access rows from invitation
         if (invite.bucketAccess.length > 0) {
            await tx.bucketAccess.createMany({
               data: invite.bucketAccess.map((ba) => ({
                  userId: req.user!.id,
                  serverId: invite.serverId,
                  bucketName: ba.bucketName,
                  role: ba.role,
               })),
            });
         }

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
         await prisma.$transaction([
            prisma.bucketAccess.deleteMany({
               where: { userId, serverId },
            }),
            prisma.serverAccess.delete({
               where: { userId_serverId: { userId, serverId } },
            }),
         ]);
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
      const { role, serverId, userId, bucketAccess } = req.body as {
         role: Role;
         serverId: string;
         userId: string;
         bucketAccess?: BucketAccessEntry[];
      };
      try {
         await prisma.$transaction(async (tx) => {
            await tx.serverAccess.update({
               where: { userId_serverId: { userId, serverId } },
               data: { role },
            });

            if (bucketAccess !== undefined) {
               // Replace all bucket access rows for this user on this server
               await tx.bucketAccess.deleteMany({
                  where: { userId, serverId },
               });

               if (bucketAccess.length > 0) {
                  await tx.bucketAccess.createMany({
                     data: bucketAccess.map((ba) => ({
                        userId,
                        serverId,
                        bucketName: ba.bucketName,
                        role: ba.role,
                     })),
                  });
               }
            }
         });
         res.status(200).json({ message: "User role updated successfully" });
      } catch (error) {
         console.error("Error updating user role:", error);
         res.status(500).json({ message: "Internal server error" });
      }
   }
);

export default inviteRouter;
