import { AuditLevel } from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   ownedServers: vi.fn(),
   memberships: vi.fn(),
   deleteInvites: vi.fn(),
   writeAudits: vi.fn(),
   sendEmail: vi.fn(),
   invalidate: vi.fn(),
   error: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      server: { findMany: h.ownedServers },
      serverAccess: { findMany: h.memberships },
      pendingInvitation: { deleteMany: h.deleteInvites },
   },
}));
vi.mock("@/lib/audit/writer", () => ({ writeAudits: h.writeAudits }));
vi.mock("@s3-viewer/email", () => ({ sendAccountDeletedEmail: h.sendEmail }));
vi.mock("@/lib/s3/client-cache", () => ({ invalidateS3Client: h.invalidate }));
vi.mock("@/lib/logger", () => ({
   logger: { error: h.error, warn: vi.fn() },
}));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: () => ({}),
}));

const { accountDeletionHooks } = await import("./account");

const user = {
   id: "leaver",
   email: "leaver@example.com",
   name: "Leaver",
   emailVerified: true,
};

const membership = (serverId: string, sent: string[], auditEnabled = true) => ({
   serverId,
   server: {
      auditEnabled,
      auditLevel: "CHANGES",
      pendingInvitations: sent.map((email) => ({ email })),
   },
});

beforeEach(() => {
   vi.clearAllMocks();
   h.ownedServers.mockResolvedValue([
      { id: "owned-1", name: "Media", auditEnabled: true, auditLevel: "ALL" },
   ]);
   h.memberships.mockResolvedValue([]);
   h.deleteInvites.mockResolvedValue({ count: 0 });
   h.writeAudits.mockResolvedValue(undefined);
   h.sendEmail.mockResolvedValue(undefined);
});

describe("account deletion", () => {
   it("records each owned server's deletion, and the departure and the invites it cancels on each server the user did not own, only once the account is gone", async () => {
      h.memberships.mockResolvedValue([
         membership("joined-1", ["a@example.com", "b@example.com"]),
         membership("joined-2", [], false),
      ]);
      await accountDeletionHooks.beforeDelete(user);
      expect(h.memberships).toHaveBeenCalledExactlyOnceWith({
         where: { userId: "leaver", server: { ownerId: { not: "leaver" } } },
         select: {
            serverId: true,
            server: {
               select: {
                  auditEnabled: true,
                  auditLevel: true,
                  pendingInvitations: {
                     where: {
                        invitedById: "leaver",
                        expiresAt: { gt: expect.any(Date) },
                     },
                     select: { email: true },
                  },
               },
            },
         },
      });
      expect(h.writeAudits).not.toHaveBeenCalled();

      await accountDeletionHooks.afterDelete(user);
      const actor = { id: "leaver", email: "leaver@example.com" };
      expect(h.writeAudits.mock.calls.map((call) => call[0])).toEqual([
         {
            serverId: "owned-1",
            actor,
            audit: { enabled: true, level: AuditLevel.ALL },
            entries: [
               {
                  action: "server.delete",
                  detail: { name: "Media", reason: "account_deleted" },
               },
            ],
         },
         {
            serverId: "joined-1",
            actor,
            audit: { enabled: true, level: AuditLevel.CHANGES },
            entries: [
               {
                  action: "server.leave",
                  detail: { reason: "account_deleted" },
               },
               {
                  action: "invite.revoke",
                  target: "a@example.com",
                  detail: { reason: "account_deleted" },
               },
               {
                  action: "invite.revoke",
                  target: "b@example.com",
                  detail: { reason: "account_deleted" },
               },
            ],
         },
         {
            serverId: "joined-2",
            actor,
            audit: { enabled: false, level: AuditLevel.CHANGES },
            entries: [
               {
                  action: "server.leave",
                  detail: { reason: "account_deleted" },
               },
            ],
         },
      ]);
      expect(h.invalidate).toHaveBeenCalledExactlyOnceWith("owned-1");
      expect(h.sendEmail).toHaveBeenCalledOnce();
   });

   it("records nothing when the deletion never completes, or twice for one deletion", async () => {
      h.memberships.mockResolvedValue([membership("joined-1", [])]);
      await accountDeletionHooks.beforeDelete(user);
      expect(h.writeAudits).not.toHaveBeenCalled();

      await accountDeletionHooks.afterDelete(user);
      await accountDeletionHooks.afterDelete(user);
      expect(h.writeAudits).toHaveBeenCalledTimes(2);
   });

   it("finishes the deletion when the audit rows cannot be written", async () => {
      h.memberships.mockResolvedValue([membership("joined-1", [])]);
      h.writeAudits.mockRejectedValue(new Error("database went away"));
      await accountDeletionHooks.beforeDelete(user);
      await expect(
         accountDeletionHooks.afterDelete(user)
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith("Account deletion audit failed", {
         error: expect.stringContaining("database went away"),
      });
      expect(h.invalidate).toHaveBeenCalledExactlyOnceWith("owned-1");
      expect(h.sendEmail).toHaveBeenCalledOnce();
   });

   it("removes invites addressed to a verified user only once the account is gone", async () => {
      await accountDeletionHooks.beforeDelete(user);
      expect(h.deleteInvites).not.toHaveBeenCalled();
      await accountDeletionHooks.afterDelete(user);
      expect(h.deleteInvites).toHaveBeenCalledExactlyOnceWith({
         where: { email: "leaver@example.com" },
      });
      h.deleteInvites.mockClear();
      const unverified = { ...user, emailVerified: false };
      await accountDeletionHooks.beforeDelete(unverified);
      await accountDeletionHooks.afterDelete(unverified);
      expect(h.deleteInvites).not.toHaveBeenCalled();
   });

   it("finishes the deletion when the addressed invites cannot be removed", async () => {
      h.deleteInvites.mockRejectedValue(new Error("database went away"));
      await accountDeletionHooks.beforeDelete(user);
      await expect(
         accountDeletionHooks.afterDelete(user)
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith(
         "Account deletion invite cleanup failed",
         { error: expect.stringContaining("database went away") }
      );
      expect(h.sendEmail).toHaveBeenCalledOnce();
   });
});

describe("shared servers", () => {
   it("names only owned servers that someone else can still use", async () => {
      h.ownedServers.mockResolvedValue([{ name: "Media" }, { name: "Ops" }]);
      await expect(
         accountDeletionHooks.sharedServerNames("leaver")
      ).resolves.toEqual(["Media", "Ops"]);
      expect(h.ownedServers).toHaveBeenCalledExactlyOnceWith({
         where: {
            ownerId: "leaver",
            serverAccess: { some: { userId: { not: "leaver" } } },
         },
         select: { name: true },
         orderBy: { name: "asc" },
      });
   });

   it("reports nothing when every owned server is used by its owner alone", async () => {
      h.ownedServers.mockResolvedValue([]);
      await expect(
         accountDeletionHooks.sharedServerNames("leaver")
      ).resolves.toEqual([]);
   });
});
