import type { Prisma } from "@prisma/client";
import { Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { senderCanStillGrant } from "./invites";
import { revokeInvalidInvites } from "./invite-authority";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({ decryptCredentials: () => ({}) }));

const txAs = (
   senderRole: Role | null,
   bucketRole: Role | null = Role.EDITOR,
   allowedBuckets = ["photos"]
) =>
   ({
      bucketAccess: {
         findMany: async () =>
            bucketRole
               ? [
                    {
                       userId: "user_1",
                       serverId: "srv_1",
                       bucketName: "photos",
                       role: bucketRole,
                    },
                 ]
               : [],
      },
      serverAccess: {
         findMany: async () =>
            senderRole
               ? [
                    {
                       userId: "user_1",
                       serverId: "srv_1",
                       role: senderRole,
                       server: { restrictedBuckets: true, allowedBuckets },
                    },
                 ]
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

describe("bucket authority at acceptance", () => {
   it("rejects an admin whose bucket grant was revoked", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.ADMIN, null),
            invite(Role.VIEWER, [{ role: Role.VIEWER }])
         )
      ).resolves.toBe(false);
   });
   it("rejects an admin whose bucket grant was downgraded", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.ADMIN, Role.VIEWER),
            invite(Role.EDITOR, [{ role: Role.EDITOR }])
         )
      ).resolves.toBe(false);
   });
   it("rejects a removed bucket even for an owner's invite", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.OWNER, null, []),
            invite(Role.EDITOR, [{ role: Role.EDITOR }])
         )
      ).resolves.toBe(false);
   });
   it("lets an owner grant an allowed bucket without an explicit bucket grant", async () => {
      await expect(
         senderCanStillGrant(
            txAs(Role.OWNER, null),
            invite(Role.EDITOR, [{ role: Role.EDITOR }])
         )
      ).resolves.toBe(true);
   });
});

describe("pending invitation invalidation", () => {
   it("deletes grants that exceed the sender's current access and never revives them", async () => {
      let currentRole = Role.VIEWER;
      let pending = [
         { id: "valid", ...invite(Role.VIEWER, [{ role: Role.VIEWER }]) },
         { id: "revoked", ...invite(Role.EDITOR, [{ role: Role.EDITOR }]) },
      ];
      const tx = {
         ...txAs(Role.ADMIN),
         bucketAccess: {
            findMany: async () => [
               {
                  userId: "user_1",
                  serverId: "srv_1",
                  bucketName: "photos",
                  role: currentRole,
               },
            ],
         },
         pendingInvitation: {
            findMany: async () => pending,
            deleteMany: vi.fn(
               async ({ where }: { where: { id: { in: string[] } } }) => {
                  pending = pending.filter(
                     (row) => !where.id.in.includes(row.id)
                  );
               }
            ),
         },
      };
      await revokeInvalidInvites(
         tx as unknown as Prisma.TransactionClient,
         "srv_1"
      );
      expect(pending.map((row) => row.id)).toEqual(["valid"]);
      currentRole = Role.EDITOR;
      await revokeInvalidInvites(
         tx as unknown as Prisma.TransactionClient,
         "srv_1"
      );
      expect(pending.map((row) => row.id)).toEqual(["valid"]);
      expect(tx.pendingInvitation.deleteMany).toHaveBeenCalledTimes(1);
   });
   it("deletes every invitation from a removed sender", async () => {
      const tx = {
         ...txAs(null),
         pendingInvitation: {
            findMany: async () => [{ id: "old", ...invite(Role.VIEWER) }],
            deleteMany: vi.fn(),
         },
      };
      await revokeInvalidInvites(
         tx as unknown as Prisma.TransactionClient,
         "srv_1"
      );
      expect(tx.pendingInvitation.deleteMany).toHaveBeenCalledWith({
         where: { id: { in: ["old"] } },
      });
   });
});
