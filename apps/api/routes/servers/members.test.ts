import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";

const ACTOR = "actor12345";
const TARGET = "target1234";

const state = vi.hoisted(() => ({
   actorRole: "OWNER" as DbRole | null,
   targetRole: "EDITOR" as DbRole | null,
   memberGrants: [] as {
      bucketName: string;
      role: string;
      folders: string[] | null;
   }[],
   // what the acting admin holds themselves, read back by the bucket-name filter.
   actorGrants: [] as {
      bucketName: string;
      role: string;
      folders: string[] | null;
   }[],
   currentGrants: [] as {
      bucketName: string;
      role: string;
      restrictedFolders: boolean;
      allowedFolders: string[];
   }[],
   memberFound: true,
   recordMany: vi.fn(),
   revokeInvites: vi.fn(),
   update: vi.fn(),
   removeMembership: vi.fn(),
   clamp: vi.fn(),
   listMembers: vi.fn(async () => ({ members: [], nextCursor: null })),
   deleteAccess: vi.fn(),
   deleteGrants: vi.fn(),
   writeAudit: vi.fn(),
   beforeScopeLock: vi.fn(),
}));

vi.mock("@/lib/audit/writer", async (original) => ({
   ...(await original<typeof import("@/lib/audit/writer")>()),
   writeAudit: state.writeAudit,
   recentlySeen: () => false,
}));

vi.mock("@/lib/middleware/audit-record", () => ({
   record: vi.fn(),
   recordAlways: vi.fn(),
   recordMany: state.recordMany,
}));

vi.mock("@/lib/services/invite-authority", () => ({
   revokeInvalidInvites: state.revokeInvites,
   senderCanStillGrant: vi.fn(),
   stillGrantable: vi.fn(),
}));

vi.mock("@/lib/services/servers", async (original) => ({
   ...(await original<typeof import("@/lib/services/servers")>()),
   lockBucketScope: async () => {
      await state.beforeScopeLock();
      return { restrictedBuckets: false, allowedBuckets: [] };
   },
}));

vi.mock("@/lib/services/members", async (original) => ({
   ...(await original<typeof import("@/lib/services/members")>()),
   listMembers: state.listMembers,
   loadBucketGrants: async () => state.currentGrants,
   loadGrantingActor: async () => ({
      serverRole: "OWNER",
      bucketGrants: new Map(),
   }),
   assertBucketGrantChanges: () => undefined,
   replaceBucketAccess: async () => undefined,
   clampBucketAccess: state.clamp,
   removeMembership: state.removeMembership,
   findMember: async () =>
      state.memberFound
         ? {
              id: TARGET,
              name: "Target",
              email: "target@example.com",
              role: "EDITOR",
              bucketAccess: state.memberGrants,
           }
         : null,
}));

const findAccess = async (args: {
   where: { userId_serverId: { userId: string } };
   select?: { server?: unknown; user?: unknown };
}) => {
   const { userId } = args.where.userId_serverId;
   const role = userId === ACTOR ? state.actorRole : state.targetRole;
   if (!role) return null;
   if (args.select?.server) return { role, server: { auditEnabled: true } };
   if (args.select?.user)
      return { role, user: { email: "target@example.com" } };
   return { role };
};

const scopeProbe = scopeQueryRaw(() =>
   state.actorRole ? { role: state.actorRole, auditEnabled: true } : null
);

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: { findUnique: findAccess },
      $queryRaw: scopeProbe,
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
         work({
            serverAccess: {
               findUnique: findAccess,
               update: state.update,
               deleteMany: state.deleteAccess,
            },
            bucketAccess: {
               deleteMany: state.deleteGrants,
               findMany: async ({
                  where,
               }: {
                  where: { bucketName?: unknown };
               }) =>
                  (where.bucketName
                     ? state.actorGrants
                     : state.memberGrants
                  ).map(({ folders, ...grant }) => ({
                     ...grant,
                     restrictedFolders: folders !== null,
                     allowedFolders: folders ?? [],
                  })),
            },
         }),
   },
}));

const { membersRouter } = await import("./members");
const { recordDenials } = await import("@/lib/middleware/route");
const { removeMembership } = await vi.importActual<
   typeof import("@/lib/services/members")
>("@/lib/services/members");

let base: string;
let selfBase: string;
let listBase: string;

routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: ACTOR })));
      app.use("/servers", membersRouter);
      app.use(recordDenials);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/members/${TARGET}`;
      selfBase = `${origin}/servers/server12345/members/${ACTOR}`;
      listBase = `${origin}/servers/server12345/members`;
   }
);

beforeEach(() => {
   state.actorRole = "OWNER";
   state.targetRole = "EDITOR";
   state.memberGrants = [];
   state.actorGrants = [];
   state.currentGrants = [];
   state.memberFound = true;
   state.beforeScopeLock.mockReset();
   state.recordMany.mockReset().mockResolvedValue(undefined);
   state.revokeInvites.mockReset().mockResolvedValue([]);
   state.update.mockReset().mockResolvedValue({ role: "ADMIN" });
   state.removeMembership.mockReset().mockImplementation(
      async (
         _userId: string,
         _serverId: string,
         actor?: {
            assertAuthority: (roles: {
               serverRole: DbRole | null;
               targetRole: DbRole | null;
            }) => void;
         }
      ) => {
         actor?.assertAuthority({
            serverRole: state.actorRole,
            targetRole: state.targetRole,
         });
         return { email: "target@example.com", revokedInvites: [] };
      }
   );
   state.clamp.mockReset().mockResolvedValue(undefined);
   state.deleteAccess.mockReset().mockResolvedValue({ count: 1 });
   state.deleteGrants.mockReset().mockResolvedValue({ count: 0 });
   state.writeAudit.mockReset().mockResolvedValue(undefined);
   state.listMembers
      .mockReset()
      .mockResolvedValue({ members: [], nextCursor: null });
});

const patchRole = (body: Record<string, unknown>) =>
   fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const entry = () => state.recordMany.mock.calls[0]?.[1]?.[0];

const revoked = [
   {
      action: "invite.revoke",
      target: "invitee@example.com",
      detail: { reason: "sender_authority" },
   },
];

describe("GET /servers/:serverId/members", () => {
   it("passes the query's cursor and a default limit through to listMembers", async () => {
      const res = await fetch(listBase);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ members: [], nextCursor: null });
      expect(state.listMembers).toHaveBeenCalledWith(
         "server12345",
         undefined,
         50
      );
   });

   it("forwards an explicit cursor and limit", async () => {
      const res = await fetch(`${listBase}?cursor=abc123&limit=10`);
      expect(res.status).toBe(200);
      expect(state.listMembers).toHaveBeenCalledWith(
         "server12345",
         "abc123",
         10
      );
   });

   it("rejects a limit above the maximum page size", async () => {
      const res = await fetch(`${listBase}?limit=1000`);
      expect(res.status).toBe(400);
      expect(state.listMembers).not.toHaveBeenCalled();
   });

   it("refuses a member who may not manage members", async () => {
      state.actorRole = "EDITOR";
      const res = await fetch(listBase);
      expect(res.status).toBe(403);
      expect(state.listMembers).not.toHaveBeenCalled();
   });
});

describe("PATCH /servers/:serverId/members/:userId", () => {
   it("records the new role, the member's id and their bucket grants", async () => {
      state.memberGrants = [
         { bucketName: "beta", role: "VIEWER", folders: null },
         { bucketName: "alpha", role: "EDITOR", folders: null },
      ];
      const res = await patchRole({
         role: "ADMIN",
         bucketAccess: [
            { bucketName: "alpha", role: "EDITOR", folders: null },
            { bucketName: "beta", role: "VIEWER", folders: null },
         ],
         previousBucketAccess: [],
      });
      expect(res.status).toBe(200);
      expect(entry()).toEqual({
         action: "member.role_change",
         target: "target@example.com",
         detail: {
            role: "ADMIN",
            userId: TARGET,
            buckets: "alpha:EDITOR,beta:VIEWER",
         },
      });
   });

   const limited = {
      bucketName: "company",
      role: "EDITOR",
      restrictedFolders: true,
      allowedFolders: ["landing/"],
   };
   const shown = {
      bucketName: "company",
      role: "EDITOR",
      folders: ["landing/"],
   };

   it("refuses new access from a client that does not say what it was editing", async () => {
      const res = await patchRole({ role: "EDITOR", bucketAccess: [shown] });
      expect(res.status).toBe(400);
      expect(state.update).not.toHaveBeenCalled();
   });

   it("refuses a save over access that changed since the editor opened", async () => {
      state.currentGrants = [limited];
      const widened = { ...shown, folders: null };
      for (const previousBucketAccess of [
         [widened],
         [],
         [{ ...shown, role: "VIEWER" }],
         [{ ...shown, folders: ["landing/", "blog/"] }],
         [shown, { bucketName: "other", role: "VIEWER", folders: null }],
      ]) {
         const res = await patchRole({
            role: "EDITOR",
            bucketAccess: [widened],
            previousBucketAccess,
         });
         expect(res.status).toBe(409);
      }
      expect(state.update).not.toHaveBeenCalled();
   });

   it("accepts a save made from the member's current access", async () => {
      state.currentGrants = [limited];
      const res = await patchRole({
         role: "EDITOR",
         bucketAccess: [{ ...shown, folders: ["landing/", "blog/"] }],
         previousBucketAccess: [shown],
      });
      expect(res.status).toBe(200);
   });

   it("accepts a repeated save whose access is already stored", async () => {
      state.currentGrants = [
         { ...limited, allowedFolders: ["landing/", "blog/"] },
      ];
      const res = await patchRole({
         role: "EDITOR",
         bucketAccess: [{ ...shown, folders: ["landing/", "blog/"] }],
         previousBucketAccess: [shown],
      });
      expect(res.status).toBe(200);
   });

   it("refuses folder limits on an admin's access", async () => {
      const res = await patchRole({
         role: "ADMIN",
         bucketAccess: [shown],
         previousBucketAccess: [],
      });
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
         message: expect.stringContaining("Admins can't be limited to folders"),
      });
   });

   it("refuses promoting a folder-limited member to admin without widening them", async () => {
      state.currentGrants = [limited];
      const res = await patchRole({ role: "ADMIN" });
      expect(res.status).toBe(409);
      await expect(res.json()).resolves.toMatchObject({
         message: expect.stringContaining("company is limited to folders"),
      });
      expect(state.update).not.toHaveBeenCalled();
      expect((await patchRole({ role: "VIEWER" })).status).toBe(200);
   });

   it("leaves buckets out of the detail when the member holds no grant", async () => {
      expect((await patchRole({ role: "VIEWER" })).status).toBe(200);
      expect(entry()).toEqual({
         action: "member.role_change",
         target: "target@example.com",
         detail: { role: "VIEWER", userId: TARGET },
      });
   });

   it("clamps a demotion with the actor's own role, so it can't outrun the grant guard", async () => {
      state.actorRole = "ADMIN";
      state.targetRole = "EDITOR";
      expect((await patchRole({ role: "VIEWER" })).status).toBe(200);
      expect(state.clamp).toHaveBeenCalledWith(
         expect.anything(),
         TARGET,
         "server12345",
         "VIEWER",
         { id: ACTOR, role: "ADMIN" }
      );
   });

   it("leaves bucket grants alone when the role does not go down", async () => {
      state.targetRole = "VIEWER";
      expect((await patchRole({ role: "ADMIN" })).status).toBe(200);
      expect(state.clamp).not.toHaveBeenCalled();
   });

   it("records nothing when the actor may not manage members", async () => {
      state.actorRole = "EDITOR";
      expect((await patchRole({ role: "VIEWER" })).status).toBe(403);
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("records nothing when the target is not a member", async () => {
      state.targetRole = null;
      expect((await patchRole({ role: "VIEWER" })).status).toBe(404);
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("rolls the change back and records nothing when the member cannot be read back inside the transaction", async () => {
      state.memberFound = false;
      state.revokeInvites.mockResolvedValue(revoked);
      expect((await patchRole({ role: "VIEWER" })).status).toBe(404);
      expect(state.revokeInvites).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("records the invites a change of access revoked, after the change itself", async () => {
      state.revokeInvites.mockResolvedValue(revoked);
      expect((await patchRole({ role: "VIEWER" })).status).toBe(200);
      expect(state.recordMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [expect.objectContaining({ action: "member.role_change" }), ...revoked]
      );
   });

   it("records no revoked invites for a refused change", async () => {
      state.actorRole = "EDITOR";
      expect((await patchRole({ role: "VIEWER" })).status).toBe(403);
      expect(state.revokeInvites).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });
});

describe("DELETE /servers/:serverId/members/:userId", () => {
   it("refuses and audits removing a member whose bucket access is protected", async () => {
      state.actorRole = "ADMIN";
      state.memberGrants = [
         { bucketName: "photos", role: "ADMIN", folders: null },
      ];
      state.removeMembership.mockImplementation(removeMembership);
      expect((await fetch(base, { method: "DELETE" })).status).toBe(403);
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.deleteGrants).not.toHaveBeenCalled();
      expect(state.writeAudit).toHaveBeenCalledWith(
         expect.objectContaining({
            entry: expect.objectContaining({
               action: "access.denied",
               detail: { permission: "MANAGE_MEMBERS", reason: "member" },
            }),
         })
      );
   });

   it.each(["protected grant added", "actor demoted", "membership removed"])(
      "rechecks membership removal after %s while waiting for the server lock",
      async (change) => {
         state.actorRole = "ADMIN";
         state.removeMembership.mockImplementation(removeMembership);
         let reachedLock!: () => void;
         let resume!: () => void;
         const waiting = new Promise<void>((resolve) => {
            reachedLock = resolve;
         });
         const held = new Promise<void>((resolve) => {
            resume = resolve;
         });
         state.beforeScopeLock.mockImplementationOnce(async () => {
            reachedLock();
            await held;
         });
         const response = fetch(base, { method: "DELETE" });
         await waiting;
         if (change === "protected grant added")
            state.memberGrants = [
               { bucketName: "photos", role: "ADMIN", folders: null },
            ];
         if (change === "actor demoted") state.actorRole = "EDITOR";
         if (change === "membership removed") state.actorRole = null;
         resume();
         expect((await response).status).toBe(403);
         expect(state.deleteAccess).not.toHaveBeenCalled();
         expect(state.deleteGrants).not.toHaveBeenCalled();
      }
   );

   it.each(["OWNER", "ADMIN"] as const)(
      "allows %s to remove grants within their authority",
      async (role) => {
         state.actorRole = role;
         state.memberGrants = [
            {
               bucketName: "photos",
               role: role === "OWNER" ? "ADMIN" : "EDITOR",
               folders: null,
            },
         ];
         state.actorGrants = [
            { bucketName: "photos", role: "EDITOR", folders: null },
         ];
         state.removeMembership.mockImplementation(removeMembership);
         expect((await fetch(base, { method: "DELETE" })).status).toBe(204);
         expect(state.deleteAccess).toHaveBeenCalledOnce();
         expect(state.deleteGrants).toHaveBeenCalledOnce();
      }
   );

   it("refuses an admin removing a member whose grant sits on a bucket the admin does not hold", async () => {
      state.actorRole = "ADMIN";
      state.memberGrants = [
         { bucketName: "photos", role: "EDITOR", folders: null },
      ];
      state.actorGrants = [];
      state.removeMembership.mockImplementation(removeMembership);
      const res = await fetch(base, { method: "DELETE" });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
         message: expect.stringContaining("photos"),
      });
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.deleteGrants).not.toHaveBeenCalled();
   });

   it("records the removed member's address and id", async () => {
      const res = await fetch(base, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(state.removeMembership).toHaveBeenCalledWith(
         TARGET,
         "server12345",
         { id: ACTOR, assertAuthority: expect.any(Function) }
      );
      expect(entry()).toEqual({
         action: "member.remove",
         target: "target@example.com",
         detail: { userId: TARGET },
      });
      expect(state.recordMany).toHaveBeenCalledOnce();
   });

   it("records the invites the removed member had sent as revoked", async () => {
      state.revokeInvites.mockResolvedValue(revoked);
      state.removeMembership.mockImplementation(removeMembership);
      expect((await fetch(base, { method: "DELETE" })).status).toBe(204);
      expect(state.recordMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [expect.objectContaining({ action: "member.remove" }), ...revoked]
      );
   });

   it("records nothing when the membership row is already gone", async () => {
      state.targetRole = null;
      state.removeMembership.mockImplementation(removeMembership);
      expect((await fetch(base, { method: "DELETE" })).status).toBe(404);
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("answers a viewer 403 whether or not the target is a member", async () => {
      state.actorRole = "VIEWER";
      state.removeMembership.mockImplementation(removeMembership);
      expect((await fetch(base, { method: "DELETE" })).status).toBe(403);
      state.targetRole = null;
      expect((await fetch(base, { method: "DELETE" })).status).toBe(403);
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("records nothing when the actor may not manage the target", async () => {
      state.targetRole = "OWNER";
      expect((await fetch(base, { method: "DELETE" })).status).toBe(403);
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("refuses a member removing their own row and deletes nothing", async () => {
      state.actorRole = "ADMIN";
      state.removeMembership.mockImplementation(removeMembership);
      const res = await fetch(selfBase, { method: "DELETE" });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You can't manage that member",
      });
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.deleteGrants).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });

   it("refuses an owner removing their own row", async () => {
      state.actorRole = "OWNER";
      state.removeMembership.mockImplementation(removeMembership);
      const res = await fetch(selfBase, { method: "DELETE" });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You can't manage that member",
      });
      expect(state.deleteAccess).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });
});

describe("a refusal raised inside the transaction", () => {
   it("still writes the access.denied entry", async () => {
      state.actorRole = "EDITOR";
      expect((await patchRole({ role: "VIEWER" })).status).toBe(403);
      expect(state.writeAudit).toHaveBeenCalledWith({
         serverId: "server12345",
         actor: { id: ACTOR, email: "actor@example.com" },
         audit: { enabled: true, level: "ALL" },
         entry: {
            action: "access.denied",
            bucket: null,
            detail: { permission: "MANAGE_MEMBERS", reason: "forbidden" },
         },
      });
      expect(state.recordMany).not.toHaveBeenCalled();
   });
});
