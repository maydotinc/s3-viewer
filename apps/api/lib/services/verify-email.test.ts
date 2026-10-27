import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { verifyAccountEmail } from "./verify-email";

const fixture = (emailVerified = false) => {
   const user = {
      id: "account123",
      email: "owner@example.com",
      emailVerified,
      createdAt: new Date(),
   };
   const db = {
      user: {
         findUnique: vi.fn(async () => user),
         updateMany: vi.fn(async () => ({ count: 1 })),
      },
      session: { deleteMany: vi.fn(async () => ({ count: 1 })) },
   };
   return { db, tx: db as unknown as Prisma.TransactionClient, user };
};

describe("operator email verification", () => {
   it("only previews an account when no id is supplied", async () => {
      const f = fixture();
      expect((await verifyAccountEmail(f.tx, f.user.email)).changed).toBe(
         false
      );
      expect(f.db.user.updateMany).not.toHaveBeenCalled();
      expect(f.db.session.deleteMany).not.toHaveBeenCalled();
   });
   it("rejects confirmation for a different account", async () => {
      const f = fixture();
      await expect(
         verifyAccountEmail(f.tx, f.user.email, "wrong123")
      ).rejects.toThrow(/does not match/);
      expect(f.db.user.updateMany).not.toHaveBeenCalled();
   });
   it("verifies only the selected account and revokes its sessions", async () => {
      const f = fixture();
      expect(
         (await verifyAccountEmail(f.tx, f.user.email, f.user.id)).changed
      ).toBe(true);
      expect(f.db.user.updateMany).toHaveBeenCalledWith({
         where: { id: f.user.id, email: f.user.email, emailVerified: false },
         data: { emailVerified: true },
      });
      expect(f.db.session.deleteMany).toHaveBeenCalledWith({
         where: { userId: f.user.id },
      });
   });
   it("does not revoke sessions again on an idempotent retry", async () => {
      const f = fixture(true);
      expect(
         (await verifyAccountEmail(f.tx, f.user.email, f.user.id)).changed
      ).toBe(false);
      expect(f.db.session.deleteMany).not.toHaveBeenCalled();
   });
});
