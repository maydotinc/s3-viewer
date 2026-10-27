import type { Prisma } from "@prisma/client";
import { DAY_MS, Role } from "@s3-viewer/shared";
import { describe, expect, it, vi } from "vitest";
import { inviteRevoked, revokeInvalidInvites } from "./invite-authority";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: () => ({}),
}));

const pending = (id: string, role: Role, expiresInMs = DAY_MS) => ({
   id,
   email: `${id}@example.com`,
   expiresAt: new Date(Date.now() + expiresInMs),
   invitedById: "sender",
   serverId: "srv_1",
   role,
   bucketAccess: [],
});

const txWith = (
   senderRole: Role | null,
   invites: ReturnType<typeof pending>[]
) => {
   const deleteMany = vi.fn();
   const tx = {
      bucketAccess: { findMany: async () => [] },
      serverAccess: {
         findMany: async () =>
            senderRole
               ? [
                    {
                       userId: "sender",
                       serverId: "srv_1",
                       role: senderRole,
                       server: { restrictedBuckets: false, allowedBuckets: [] },
                    },
                 ]
               : [],
      },
      pendingInvitation: { findMany: async () => invites, deleteMany },
   } as unknown as Prisma.TransactionClient;
   return { tx, deleteMany };
};

describe("revokeInvalidInvites", () => {
   it("reports each live invite it revoked so the caller can audit it", async () => {
      const { tx, deleteMany } = txWith(Role.ADMIN, [
         pending("kept", Role.EDITOR),
         pending("too-high", Role.ADMIN),
         pending("also-too-high", Role.ADMIN),
      ]);
      expect(await revokeInvalidInvites(tx, "srv_1")).toEqual([
         {
            action: "invite.revoke",
            target: "too-high@example.com",
            detail: { reason: "sender_authority" },
         },
         {
            action: "invite.revoke",
            target: "also-too-high@example.com",
            detail: { reason: "sender_authority" },
         },
      ]);
      expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
         where: { id: { in: ["too-high", "also-too-high"] } },
      });
   });

   it("deletes an expired invite without reporting it as an access change", async () => {
      const { tx, deleteMany } = txWith(null, [
         pending("live", Role.VIEWER),
         pending("expired", Role.VIEWER, -DAY_MS),
      ]);
      expect(await revokeInvalidInvites(tx, "srv_1")).toEqual([
         inviteRevoked("live@example.com", "sender_authority"),
      ]);
      expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
         where: { id: { in: ["live", "expired"] } },
      });
   });

   it("reports nothing and deletes nothing while every invite is still grantable", async () => {
      const { tx, deleteMany } = txWith(Role.ADMIN, [
         pending("kept", Role.VIEWER),
      ]);
      expect(await revokeInvalidInvites(tx, "srv_1")).toEqual([]);
      expect(deleteMany).not.toHaveBeenCalled();
   });
});
