import type { Prisma } from "@prisma/client";
import { Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import {
   revokeInvalidInvites,
   senderCanStillGrant,
   stillGrantable,
} from "./invite-authority";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: () => ({}),
}));

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
                       restrictedFolders: false,
                       allowedFolders: [],
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
      restrictedFolders: false,
      allowedFolders: [],
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

describe("stillGrantable", () => {
   it("queries each requested sender/server pair once without cross-combinations", async () => {
      const findMany = vi.fn(async () => []);
      const tx = {
         serverAccess: { findMany },
         bucketAccess: { findMany: vi.fn(async () => []) },
      } as unknown as Prisma.TransactionClient;
      await stillGrantable(tx, [
         invite(Role.VIEWER),
         invite(Role.EDITOR),
         { ...invite(Role.VIEWER), invitedById: "user_2", serverId: "srv_2" },
      ]);
      expect(findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: {
               OR: [
                  { userId: "user_1", serverId: "srv_1" },
                  { userId: "user_2", serverId: "srv_2" },
               ],
            },
         })
      );
      expect(findMany).toHaveBeenCalledOnce();
      expect(tx.bucketAccess.findMany).not.toHaveBeenCalled();
   });

   it("matches each invite to its own sender's exact server, not any row for either id", async () => {
      const tx = {
         serverAccess: {
            findMany: async () => [
               {
                  userId: "user_1",
                  serverId: "srv_1",
                  role: Role.ADMIN,
                  server: { restrictedBuckets: false, allowedBuckets: [] },
               },
               {
                  userId: "user_1",
                  serverId: "srv_2",
                  role: Role.OWNER,
                  server: { restrictedBuckets: false, allowedBuckets: [] },
               },
            ],
         },
         bucketAccess: { findMany: async () => [] },
      } as unknown as Prisma.TransactionClient;
      const invites = [
         invite(Role.VIEWER),
         { ...invite(Role.VIEWER), invitedById: "user_2", serverId: "srv_2" },
      ];
      await expect(stillGrantable(tx, invites)).resolves.toEqual([invites[0]]);
   });

   it.each([Role.OWNER, Role.ADMIN])(
      "skips bucket reads for %s invitations without bucket grants",
      async (role) => {
         const tx = txAs(role);
         const findMany = vi.spyOn(tx.bucketAccess, "findMany");
         const pending = [invite(Role.VIEWER)];
         await expect(stillGrantable(tx, pending)).resolves.toEqual(pending);
         expect(findMany).not.toHaveBeenCalled();
      }
   );

   it("skips explicit bucket reads for owners while enforcing the allowlist", async () => {
      const tx = txAs(Role.OWNER, null);
      const findMany = vi.spyOn(tx.bucketAccess, "findMany");
      const allowed = invite(Role.EDITOR, [{ role: Role.EDITOR }]);
      const removed = {
         ...allowed,
         bucketAccess: [
            {
               bucketName: "removed",
               role: Role.VIEWER,
               restrictedFolders: false,
               allowedFolders: [],
            },
         ],
      };
      await expect(stillGrantable(tx, [allowed, removed])).resolves.toEqual([
         allowed,
      ]);
      expect(findMany).not.toHaveBeenCalled();
   });

   it("reads only requested allowed buckets in one query for non-owner senders", async () => {
      const tx = txAs(Role.ADMIN);
      const findMany = vi.spyOn(tx.bucketAccess, "findMany");
      const allowed = invite(Role.EDITOR, [{ role: Role.VIEWER }]);
      const removed = {
         ...allowed,
         bucketAccess: [
            {
               bucketName: "removed",
               role: Role.VIEWER,
               restrictedFolders: false,
               allowedFolders: [],
            },
         ],
      };
      const invalidRole = { ...allowed, role: Role.ADMIN };
      await expect(
         stillGrantable(tx, [allowed, allowed, removed, invalidRole])
      ).resolves.toEqual([allowed, allowed]);
      expect(findMany).toHaveBeenCalledOnce();
      expect(findMany).toHaveBeenCalledWith({
         where: {
            OR: [
               {
                  userId: "user_1",
                  serverId: "srv_1",
                  bucketName: { in: ["photos"] },
               },
            ],
         },
         select: {
            userId: true,
            serverId: true,
            bucketName: true,
            role: true,
            restrictedFolders: true,
            allowedFolders: true,
         },
      });
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
                  restrictedFolders: false,
                  allowedFolders: [],
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
