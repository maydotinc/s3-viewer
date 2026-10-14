import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";

type Grant = {
   bucketName: string;
   role: DbRole;
   restrictedFolders: boolean;
   allowedFolders: string[];
};
type Row = { email: string; role: DbRole; bucketAccess?: Grant[] };

const grant = (bucketName: string, role: DbRole): Grant => ({
   bucketName,
   role,
   restrictedFolders: false,
   allowedFolders: [],
});

const ACTOR = "actor12345";
const SERVER = "server12345";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as DbRole | null,
   held: new Map<string, { role: string; folders: string[] | null }>(),
   loadGrantingActor: vi.fn(),
   pending: [] as { email: string; role: string; token?: string }[],
   // the buckets the acting member holds; null is an owner's view of every bucket.
   visible: null as Set<string> | null,
   grantRows: [] as {
      invitationId: string;
      bucketName: string;
      role: string;
      restrictedFolders: boolean;
      allowedFolders: string[];
   }[],
   record: vi.fn(),
   beforeScopeLock: vi.fn(),
   deleteInvites: vi.fn(),
   writeAudit: vi.fn(),
}));

vi.mock("@/lib/audit/writer", async (original) => ({
   ...(await original<typeof import("@/lib/audit/writer")>()),
   writeAudit: state.writeAudit,
   recentlySeen: () => false,
}));

vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.record,
   recordAlways: vi.fn(),
   recordMany: vi.fn(),
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
   loadGrantingActor: state.loadGrantingActor,
   assertBucketGrants: () => undefined,
   visibleBuckets: async () => state.visible,
}));

const inviteId = (email: string) => `inv${email.replace(/\W/g, "")}`;

const listedRow = ({ email, role }: { email: string; role: string }) => ({
   id: inviteId(email),
   email,
   role,
   expiresAt: new Date("2030-01-01T00:00:00.000Z"),
   serverId: SERVER,
   invitedById: ACTOR,
   server: { id: SERVER, name: "Server" },
   invitedBy: { name: "Actor", email: "actor@example.com" },
   bucketAccess: state.grantRows
      .filter((grant) => grant.invitationId === inviteId(email))
      .map(({ bucketName, role, restrictedFolders, allowedFolders }) => ({
         bucketName,
         role,
         restrictedFolders,
         allowedFolders,
      })),
});

const access = async () => (state.role ? { role: state.role } : null);

const accessWithServer = async () =>
   state.role ? { role: state.role, server: { auditEnabled: true } } : null;

const revoked = vi.hoisted(() => ({ target: null as Row | null }));

vi.mock("@s3-viewer/db", () => {
   const pendingInvitation = {
      findMany: async () => state.pending.map(listedRow),
      deleteMany: state.deleteInvites,
      findUnique: async () =>
         revoked.target
            ? {
                 ...revoked.target,
                 bucketAccess: revoked.target.bucketAccess ?? [],
              }
            : null,
   };
   const tx = {
      serverAccess: { findUnique: access },
      pendingInvitation,
   };
   return {
      prisma: {
         $queryRaw: scopeQueryRaw(() =>
            state.role ? { role: state.role, auditEnabled: true } : null
         ),
         serverAccess: { findUnique: accessWithServer },
         pendingInvitation,
         $transaction: async (work: (client: unknown) => Promise<unknown>) =>
            work(tx),
      },
   };
});

// static import would run the database mock factory before its fixture constants exist.
const { serverInvitesRouter } = await import("./invites");
const { recordDenials } = await import("@/lib/middleware/route");

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actor })));
      app.use("/servers", serverInvitesRouter);
      app.use(recordDenials);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/${SERVER}/invites`;
   }
);

beforeEach(() => {
   state.actor = ACTOR;
   state.role = "OWNER";
   state.pending = [];
   state.visible = null;
   state.grantRows = [];
   state.held.clear();
   state.loadGrantingActor
      .mockReset()
      .mockImplementation(
         async (_userId: string, _serverId: string, role: string) => ({
            serverRole: role,
            bucketGrants: state.held,
         })
      );
   revoked.target = { email: "invitee@example.com", role: "VIEWER" };
   state.record.mockReset().mockResolvedValue(undefined);
   state.beforeScopeLock.mockReset();
   state.deleteInvites.mockReset().mockResolvedValue({ count: 1 });
   state.writeAudit.mockReset().mockResolvedValue(undefined);
});

describe("GET /servers/:serverId/invites", () => {
   it("lists pending invites without reading or returning their tokens", async () => {
      state.pending = [
         { email: "one@example.com", role: "VIEWER", token: "kept-token-1" },
      ];
      const res = await fetch(base);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(JSON.parse(body).invites).toHaveLength(1);
      expect(body).not.toContain("token");
   });

   it("shows an admin only the invite grants on buckets the admin holds", async () => {
      state.role = "ADMIN";
      state.visible = new Set(["photos"]);
      state.pending = [{ email: "one@example.com", role: "VIEWER" }];
      state.grantRows = [
         {
            invitationId: inviteId("one@example.com"),
            ...grant("photos", "VIEWER"),
         },
         {
            invitationId: inviteId("one@example.com"),
            ...grant("secret", "EDITOR"),
         },
      ];
      const res = await fetch(base);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(JSON.parse(body).invites[0].bucketAccess).toEqual([
         { bucketName: "photos", role: "VIEWER", folders: null },
      ]);
      expect(body).not.toContain("secret");
   });
});

describe("DELETE /servers/:serverId/invites/:inviteId", () => {
   it.each(["ADMIN", "OWNER"] as const)(
      "checks %s authority over all invitation grants",
      async (role) => {
         state.role = role;
         revoked.target = {
            email: "invitee@example.com",
            role: "VIEWER",
            bucketAccess: [grant("photos", "ADMIN")],
         };
         expect(
            (await fetch(`${base}/invite12345`, { method: "DELETE" })).status
         ).toBe(role === "OWNER" ? 204 : 403);
         expect(state.deleteInvites).toHaveBeenCalledTimes(
            role === "OWNER" ? 1 : 0
         );
         expect(state.writeAudit).toHaveBeenCalledTimes(
            role === "OWNER" ? 0 : 1
         );
      }
   );

   it("records the invitee's address", async () => {
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(state.record.mock.calls[0]?.[1]).toEqual({
         action: "invite.revoke",
         target: "invitee@example.com",
      });
   });

   it("records nothing for an invite that is not there", async () => {
      revoked.target = null;
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
   });

   it("records nothing for an invite removed before the delete landed", async () => {
      state.deleteInvites.mockResolvedValue({ count: 0 });
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
   });

   it("refuses an admin revoking an invite with a grant on a bucket the admin doesn't hold", async () => {
      state.role = "ADMIN";
      revoked.target = {
         email: "invitee@example.com",
         role: "EDITOR",
         bucketAccess: [grant("finance", "EDITOR")],
      };
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(403);
      expect(state.deleteInvites).not.toHaveBeenCalled();
   });

   it("lets an admin revoke an invite whose grants the admin could hand out", async () => {
      state.role = "ADMIN";
      state.held.set("finance", { role: "EDITOR", folders: null });
      revoked.target = {
         email: "invitee@example.com",
         role: "EDITOR",
         bucketAccess: [grant("finance", "EDITOR")],
      };
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(state.deleteInvites).toHaveBeenCalledOnce();
      expect(state.loadGrantingActor).toHaveBeenCalledWith(
         ACTOR,
         SERVER,
         "ADMIN",
         revoked.target?.bucketAccess,
         expect.anything()
      );
   });

   it.each([
      ["refuses", null, 403],
      ["allows", ["2026/q1/"], 204],
   ] as const)(
      "%s an admin limited to a folder revoking an invite for %j",
      async (_verb, folders, status) => {
         state.role = "ADMIN";
         state.held.set("finance", { role: "EDITOR", folders: ["2026/"] });
         revoked.target = {
            email: "invitee@example.com",
            role: "EDITOR",
            bucketAccess: [
               {
                  ...grant("finance", "EDITOR"),
                  restrictedFolders: folders !== null,
                  allowedFolders: folders ? [...folders] : [],
               },
            ],
         };
         const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
         expect(res.status).toBe(status);
      }
   );

   it("records nothing when the invite outranks the actor", async () => {
      state.role = "ADMIN";
      revoked.target = { email: "invitee@example.com", role: "ADMIN" };
      const res = await fetch(`${base}/invite12345`, { method: "DELETE" });
      expect(res.status).toBe(403);
      expect(state.record).not.toHaveBeenCalled();
   });
});

describe("invitation authority while waiting for the server lock", () => {
   it.each(["protected grant added", "actor demoted", "membership removed"])(
      "rechecks a revoke after %s",
      async (change) => {
         state.role = "ADMIN";
         state.pending = [{ email: "one@example.com", role: "VIEWER" }];
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
         const response = fetch(`${base}/invite12345`, { method: "DELETE" });
         await waiting;
         if (change === "protected grant added") {
            revoked.target = {
               email: "invitee@example.com",
               role: "VIEWER",
               bucketAccess: [grant("photos", "ADMIN")],
            };
         }
         if (change === "actor demoted") state.role = "EDITOR";
         if (change === "membership removed") state.role = null;
         resume();
         expect((await response).status).toBe(403);
         expect(state.deleteInvites).not.toHaveBeenCalled();
         expect(state.writeAudit).toHaveBeenCalledOnce();
      }
   );
});
