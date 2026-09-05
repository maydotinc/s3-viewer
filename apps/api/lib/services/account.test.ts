import { logger } from "@/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   DELETED_USER_TARGET,
   accountSummary,
   eraseAccountData,
   finishAccountDeletion,
} from "./account";

const { tx, prisma, invalidateS3Client, sendAccountDeletedEmail } = vi.hoisted(
   () => {
      const tx = {
         server: { findMany: vi.fn() },
         pendingInvitation: { deleteMany: vi.fn() },
         auditLog: { updateMany: vi.fn() },
      };
      const prisma = {
         $transaction: vi.fn(async (run: (client: typeof tx) => unknown) =>
            run(tx)
         ),
         auditLog: { create: vi.fn() },
         server: { findMany: vi.fn() },
         serverAccess: { count: vi.fn() },
         pendingInvitation: { count: vi.fn() },
      };
      return {
         tx,
         prisma,
         invalidateS3Client: vi.fn(),
         sendAccountDeletedEmail: vi.fn(),
      };
   }
);

vi.mock("@s3-viewer/db", () => ({ prisma }));
vi.mock("@s3-viewer/email", () => ({ sendAccountDeletedEmail }));
vi.mock("@/lib/s3/client-cache", () => ({ invalidateS3Client }));

const error = vi.spyOn(logger, "error").mockImplementation(() => {});

const user = { id: "user_1", email: "ada@example.com", name: "Ada" };

beforeEach(() => {
   vi.clearAllMocks();
   tx.server.findMany.mockResolvedValue([{ id: "srv_1" }, { id: "srv_2" }]);
   tx.pendingInvitation.deleteMany.mockResolvedValue({ count: 1 });
   tx.auditLog.updateMany.mockResolvedValue({ count: 2 });
   prisma.auditLog.create.mockResolvedValue({ id: "audit_1" });
   sendAccountDeletedEmail.mockResolvedValue(undefined);
});

describe("eraseAccountData", () => {
   it("collects the servers the user owns before the cascade", async () => {
      await eraseAccountData(user);
      expect(tx.server.findMany).toHaveBeenCalledWith({
         where: { ownerId: "user_1" },
         select: { id: true },
      });
   });

   it("deletes the invites addressed to the user's email", async () => {
      await eraseAccountData(user);
      expect(tx.pendingInvitation.deleteMany).toHaveBeenCalledWith({
         where: { email: "ada@example.com" },
      });
   });

   it("anonymises audit rows that name the user's email", async () => {
      await eraseAccountData(user);
      expect(tx.auditLog.updateMany).toHaveBeenCalledWith({
         where: { target: "ada@example.com" },
         data: { target: DELETED_USER_TARGET },
      });
   });

   it("records nothing until the user row is really gone", async () => {
      await eraseAccountData(user);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
   });

   it("propagates a failure so the user row is not deleted", async () => {
      tx.auditLog.updateMany.mockRejectedValueOnce(new Error("db down"));
      await expect(eraseAccountData(user)).rejects.toThrow("db down");
   });
});

describe("finishAccountDeletion", () => {
   it("invalidates the cached client of every owned server", async () => {
      await eraseAccountData(user);
      expect(invalidateS3Client).not.toHaveBeenCalled();
      await finishAccountDeletion(user);
      expect(invalidateS3Client.mock.calls).toEqual([["srv_1"], ["srv_2"]]);
   });

   it("forgets the collected servers once they are invalidated", async () => {
      await eraseAccountData(user);
      await finishAccountDeletion(user);
      await finishAccountDeletion(user);
      expect(invalidateS3Client).toHaveBeenCalledTimes(2);
   });

   it("replaces a stale stash when the deletion is attempted again", async () => {
      await eraseAccountData(user);
      tx.server.findMany.mockResolvedValueOnce([{ id: "srv_3" }]);
      await eraseAccountData(user);
      await finishAccountDeletion(user);
      expect(invalidateS3Client.mock.calls).toEqual([["srv_3"]]);
   });

   it("drops a stash whose deletion never came back", async () => {
      vi.useFakeTimers();
      try {
         const ghost = { ...user, id: "user_ghost" };
         await eraseAccountData(ghost);
         vi.advanceTimersByTime(10 * 60 * 1000);
         await eraseAccountData(user);
         await finishAccountDeletion(ghost);
         expect(invalidateS3Client).not.toHaveBeenCalled();
      } finally {
         vi.useRealTimers();
      }
   });

   it("records the deletion against the user id with no target", async () => {
      await finishAccountDeletion(user);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
         data: {
            action: "account.delete",
            actorId: "user_1",
            serverId: null,
            target: null,
         },
         select: { id: true },
      });
   });

   it("sends the confirmation email", async () => {
      await finishAccountDeletion(user);
      expect(sendAccountDeletedEmail).toHaveBeenCalledWith({
         to: "ada@example.com",
         name: "Ada",
         supportEmail: undefined,
      });
   });

   it("logs instead of throwing when the email fails", async () => {
      sendAccountDeletedEmail.mockRejectedValueOnce(new Error("smtp down"));
      await expect(finishAccountDeletion(user)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith("Account deletion email failed", {
         error: "Error: smtp down",
      });
   });
});

describe("accountSummary", () => {
   it("shapes the counts the dialog lists", async () => {
      prisma.server.findMany.mockResolvedValueOnce([
         {
            id: "srv_1",
            name: "Prod",
            _count: { serverAccess: 3, pendingInvitations: 1 },
         },
      ]);
      prisma.serverAccess.count.mockResolvedValueOnce(2);
      prisma.pendingInvitation.count
         .mockResolvedValueOnce(4)
         .mockResolvedValueOnce(5);
      await expect(accountSummary(user)).resolves.toEqual({
         ownedServers: [
            {
               id: "srv_1",
               name: "Prod",
               memberCount: 3,
               pendingInviteCount: 1,
            },
         ],
         memberships: 2,
         sentInvites: 4,
         receivedInvites: 5,
      });
   });

   it("counts members without the owner and memberships without owned servers", async () => {
      prisma.server.findMany.mockResolvedValueOnce([]);
      prisma.serverAccess.count.mockResolvedValueOnce(0);
      prisma.pendingInvitation.count.mockResolvedValue(0);
      await accountSummary(user);
      expect(prisma.server.findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { ownerId: "user_1" },
            select: expect.objectContaining({
               _count: {
                  select: {
                     serverAccess: { where: { userId: { not: "user_1" } } },
                     pendingInvitations: {
                        where: { expiresAt: { gt: expect.any(Date) } },
                     },
                  },
               },
            }),
         })
      );
      expect(prisma.serverAccess.count).toHaveBeenCalledWith({
         where: { userId: "user_1", server: { ownerId: { not: "user_1" } } },
      });
   });
});
