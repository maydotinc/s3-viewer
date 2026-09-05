import type { Prisma } from "@prisma/client";
import { Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { senderCanStillGrant } from "./invites";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({ decryptCredentials: () => ({}) }));

const txAs = (senderRole: Role | null) =>
   ({
      serverAccess: {
         findMany: async () =>
            senderRole
               ? [{ userId: "user_1", serverId: "srv_1", role: senderRole }]
               : [],
      },
   }) as unknown as Prisma.TransactionClient;

const invite = (role: Role, bucketAccess: { role: Role }[] = []) => ({
   invitedById: "user_1",
   serverId: "srv_1",
   role,
   bucketAccess: bucketAccess.map((grant) => ({
      bucketName: "photos",
      ...grant,
   })),
});

describe("senderCanStillGrant", () => {
   it("accepts an invite whose sender still outranks every role it carries", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.ADMIN),
            invite(Role.EDITOR, [{ role: Role.VIEWER }])
         )
      ).resolves.toBe(true);
   });

   it("refuses an invite from a sender who has left the server", async () => {
      await expect(
         senderCanStillGrant(txAs(null), invite(Role.VIEWER))
      ).resolves.toBe(false);
   });

   it("refuses an invite from a sender who can no longer manage members", async () => {
      await expect(
         senderCanStillGrant(txAs(Role.EDITOR), invite(Role.VIEWER))
      ).resolves.toBe(false);
   });

   it("refuses a server role the sender no longer outranks", async () => {
      await expect(
         senderCanStillGrant(txAs(Role.ADMIN), invite(Role.ADMIN))
      ).resolves.toBe(false);
   });

   it("refuses a bucket grant the sender no longer outranks", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.ADMIN),
            invite(Role.VIEWER, [{ role: Role.ADMIN }])
         )
      ).resolves.toBe(false);
   });
});
