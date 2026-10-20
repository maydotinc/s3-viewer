import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "@/lib/http";
import { SERVER_PAGE_SIZE } from "@/lib/services/servers";
import { Prisma } from "@prisma/client";
import { routeServer, signedIn } from "@/lib/testing/route-harness";
import { authorizeScopeRows, type DbRole } from "@/lib/testing/scope-probe";

const ACTOR = "actor12345";
const SERVER = "server12345";

const state = vi.hoisted(() => ({
   role: "OWNER" as DbRole | null,
   previousName: "Old name" as string | null,
   record: vi.fn(),
   recordMany: vi.fn(),
   recordWithin: vi.fn(),
   appendWithin: vi.fn(),
   decrypt: vi.fn(),
   serverCreate: vi.fn(),
   serverCount: vi.fn(),
   sessionCreatedAt: Date.now(),
   removeMembership: vi.fn(),
   invalidate: vi.fn(),
   transaction: vi.fn(),
   serverDeleteMany: vi.fn(),
   auditDeleteMany: vi.fn(),
   queryRaw: vi.fn(),
   lockServer: vi.fn(),
   update: vi.fn(),
   access: vi.fn(),
   authenticated: true,
}));

vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.record,
   recordAlways: vi.fn(),
   recordMany: state.recordMany,
   recordWithin: state.recordWithin,
}));

vi.mock("@/lib/audit/writer", async (original) => ({
   ...(await original<typeof import("@/lib/audit/writer")>()),
   appendAuditWithin: state.appendWithin,
}));

vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));

vi.mock("@/lib/utils/endpoint", async (original) => ({
   ...(await original<typeof import("@/lib/utils/endpoint")>()),
   assertPublicEndpoint: vi.fn(),
}));

vi.mock("@/lib/s3/client-cache", () => ({
   invalidateS3Client: state.invalidate,
   getS3Client: vi.fn(),
   getS3ClientFromCredentials: vi.fn(),
}));

vi.mock("@/lib/services/members", async (original) => ({
   ...(await original<typeof import("@/lib/services/members")>()),
   removeMembership: state.removeMembership,
}));

const serverRow = (name: string) => ({
   id: SERVER,
   name,
   provider: "S3",
   credentials: "encrypted",
   ownerId: "owner12345",
   auditEnabled: true,
   auditViewRole: "ADMIN",
   auditManageRole: "ADMIN",
   auditRetentionDays: 0,
});

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: {
         findUnique: state.access,
      },
      server: {
         findUnique: async () =>
            state.previousName === null ? null : { name: state.previousName },
         update: state.update,
         deleteMany: state.serverDeleteMany,
      },
      auditLog: { deleteMany: state.auditDeleteMany },
      $transaction: state.transaction,
      $queryRaw: state.queryRaw,
   },
}));

const { serverCrudRouter } = await import("./servers");

let root: string;
let base: string;
let tx: ReturnType<typeof renameTransaction>;

routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => (state.authenticated ? { id: ACTOR } : null)));
      app.use((req, _res, next) => {
         Object.assign(req, {
            session: { createdAt: new Date(state.sessionCreatedAt) },
         });
         next();
      });
      app.use("/servers", serverCrudRouter);
      app.use(errorHandler);
   },
   (origin) => {
      root = `${origin}/servers`;
      base = `${root}/${SERVER}`;
   }
);

beforeEach(() => {
   state.authenticated = true;
   state.role = "OWNER";
   state.access
      .mockReset()
      .mockImplementation(async () =>
         state.role
            ? { role: state.role, server: serverRow("Selected server") }
            : null
      );
   state.previousName = "Old name";
   state.lockServer
      .mockReset()
      .mockImplementation(
         async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const query = Prisma.sql(strings, ...values);
            expect(query.text).toContain('FROM "server"');
            expect(query.text).toContain("FOR UPDATE");
            expect(query.values).toEqual([SERVER]);
            return state.previousName === null
               ? []
               : [
                    {
                       name: state.previousName,
                       auditEnabled: true,
                       auditLevel: "ALL",
                    },
                 ];
         }
      );
   state.sessionCreatedAt = Date.now();
   state.recordWithin.mockReset().mockResolvedValue(undefined);
   state.appendWithin.mockReset().mockResolvedValue(undefined);
   state.serverCount.mockReset().mockResolvedValue(0);
   state.serverCreate.mockReset().mockImplementation(async ({ data }) => ({
      ...serverRow(data.name),
      id: "created1234",
   }));
   state.decrypt.mockReset().mockReturnValue({
      endpoint: "https://s3.us-east-1.amazonaws.com",
      region: "us-east-1",
      accessKey: "key",
      secretKey: "secret",
   });
   state.record.mockReset().mockResolvedValue(undefined);
   state.recordMany.mockReset().mockResolvedValue(undefined);
   state.removeMembership
      .mockReset()
      .mockResolvedValue({ email: "actor@example.com", revokedInvites: [] });
   state.invalidate.mockReset();
   state.serverDeleteMany.mockReset().mockResolvedValue({ count: 1 });
   state.auditDeleteMany.mockReset().mockResolvedValue({ count: 3 });
   state.queryRaw
      .mockReset()
      .mockImplementation(
         async (strings: TemplateStringsArray, ...values: unknown[]) => {
            const rows = authorizeScopeRows(strings, values, () =>
               state.role ? { role: state.role, auditEnabled: true } : null
            );
            if (!rows) throw new Error("unexpected raw query in servers tests");
            return rows;
         }
      );
   state.update.mockReset().mockImplementation(async ({ data }) => {
      state.previousName = data.name;
      return serverRow(data.name);
   });
   tx = renameTransaction();
   state.transaction
      .mockReset()
      .mockImplementation(async (work: (client: typeof tx) => unknown) =>
         work(tx)
      );
});

const renameTransaction = () => ({
   $queryRaw: state.lockServer,
   $executeRaw: async () => 1,
   serverAccess: { findUnique: state.access },
   server: {
      update: state.update,
      deleteMany: state.serverDeleteMany,
      count: state.serverCount,
      create: state.serverCreate,
   },
});

const entry = () => state.record.mock.calls[0]?.[1];

const rename = (serverName: string) =>
   fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serverName }),
   });

type Page = { servers: { id: string; name: string }[]; nextCursor: string };

const accessRow = (name: string, id: string) => ({
   ...serverRow(name),
   id,
   role: "VIEWER",
});

const bindings = (call: unknown[] | undefined) => {
   const [strings, ...values] = (call ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values).values;
};

describe("GET /servers", () => {
   it("returns every membership, and no cursor, for a member of a few", async () => {
      state.queryRaw.mockResolvedValue([
         accessRow("Alpha", "alpha12345"),
         accessRow("Beta", "beta123456"),
      ]);
      const res = await fetch(root);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
         servers: [
            { id: "alpha12345", name: "Alpha", userRole: "VIEWER" },
            { id: "beta123456", name: "Beta" },
         ],
         nextCursor: null,
      });
   });

   it("bounds the page and points at the rest with a cursor", async () => {
      state.queryRaw.mockResolvedValue(
         Array.from({ length: SERVER_PAGE_SIZE + 1 }, (_, i) =>
            accessRow(`Server ${i}`, `server${i}`)
         )
      );
      const page = (await (await fetch(root)).json()) as Page;
      expect(page.servers).toHaveLength(SERVER_PAGE_SIZE);
      expect(bindings(state.queryRaw.mock.calls[0])).toEqual([
         ACTOR,
         SERVER_PAGE_SIZE + 1,
      ]);

      await fetch(`${root}?cursor=${encodeURIComponent(page.nextCursor)}`);
      expect(bindings(state.queryRaw.mock.calls[1])).toEqual([
         ACTOR,
         `Server ${SERVER_PAGE_SIZE - 1}`,
         `server${SERVER_PAGE_SIZE - 1}`,
         SERVER_PAGE_SIZE + 1,
      ]);
   });

   it("refuses a cursor it did not write", async () => {
      const cursor = Buffer.from("no separator here").toString("base64url");
      const res = await fetch(`${root}?cursor=${cursor}`);
      expect(res.status).toBe(400);
      expect(state.queryRaw).not.toHaveBeenCalled();
   });
});

describe("GET /servers/:serverId", () => {
   beforeEach(() => {
      state.queryRaw.mockImplementation(async () =>
         state.role
            ? [
                 {
                    ...serverRow("Selected server"),
                    capabilities: null,
                    restrictedBuckets: false,
                    auditLevel: "ALL",
                    role: state.role,
                 },
              ]
            : []
      );
   });

   it("resolves one server for its member in one statement", async () => {
      state.role = "VIEWER";
      const res = await fetch(base);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
         server: { id: SERVER, name: "Selected server", userRole: "VIEWER" },
      });
      expect(body.server).not.toHaveProperty("credentials");
      expect(body.server).not.toHaveProperty("ownerId");
      expect(state.queryRaw).toHaveBeenCalledOnce();
      expect(bindings(state.queryRaw.mock.calls[0])).toEqual([ACTOR, SERVER]);
   });

   it("answers missing membership without disclosing a server", async () => {
      state.role = null;
      const res = await fetch(base);
      expect(res.status).toBe(404);
      expect(await res.json()).not.toHaveProperty("server");
   });

   it("requires an authenticated user before reading membership", async () => {
      state.authenticated = false;
      expect((await fetch(base)).status).toBe(401);
      expect(state.queryRaw).not.toHaveBeenCalled();
   });
});

describe("PATCH /servers/:serverId", () => {
   it.each(["EDITOR", null] as const)(
      "rechecks authority after locking when the role becomes %s",
      async (role) => {
         const lock = state.lockServer.getMockImplementation()!;
         state.lockServer.mockImplementationOnce(async (...args) => {
            state.role = role;
            return lock(...args);
         });
         expect((await rename("New name")).status).toBe(403);
         expect(state.update).not.toHaveBeenCalled();
         expect(state.record).not.toHaveBeenCalled();
      }
   );

   it("records the new name and the one it replaced", async () => {
      const res = await rename("New name");
      expect(res.status).toBe(200);
      expect(entry()).toEqual({
         action: "server.rename",
         target: "New name",
         detail: { from: "Old name" },
      });
   });

   it("records nothing when the server is gone", async () => {
      state.previousName = null;
      expect((await rename("New name")).status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
   });

   it("records nothing for a member who may not rename", async () => {
      state.role = "EDITOR";
      expect((await rename("New name")).status).toBe(403);
      expect(state.record).not.toHaveBeenCalled();
   });
});

describe("POST /servers", () => {
   const create = () =>
      fetch(root, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            encryptedCredentials: "sealed",
            serverName: "Photos",
         }),
      });

   it("records the creation in the same transaction, even though the log starts off", async () => {
      const res = await create();
      expect(res.status).toBe(201);
      expect(state.appendWithin).toHaveBeenCalledExactlyOnceWith(
         tx,
         {
            serverId: "created1234",
            actor: { id: ACTOR, email: "actor@example.com" },
         },
         [
            {
               action: "server.create",
               detail: { name: "Photos", provider: "S3" },
            },
         ]
      );
      expect(state.transaction).toHaveBeenCalledOnce();
   });
});

describe("DELETE /servers/:serverId", () => {
   it("deletes the server and records who deleted what, in one transaction", async () => {
      const res = await fetch(base, { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(state.transaction).toHaveBeenCalledOnce();
      expect(state.serverDeleteMany).toHaveBeenCalledWith({
         where: { id: SERVER },
      });
      expect(state.recordWithin).toHaveBeenCalledExactlyOnceWith(
         tx,
         expect.anything(),
         { action: "server.delete", detail: { name: "Old name" } }
      );
      expect(state.auditDeleteMany).not.toHaveBeenCalled();
      expect(state.invalidate).toHaveBeenCalledWith(SERVER);
   });

   it("needs a sign-in from the last day, and deletes nothing without one", async () => {
      state.sessionCreatedAt = Date.now() - 25 * 60 * 60 * 1000;
      const res = await fetch(base, { method: "DELETE" });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "SESSION_STALE" });
      expect(state.serverDeleteMany).not.toHaveBeenCalled();
      expect(state.recordWithin).not.toHaveBeenCalled();
      expect(state.invalidate).not.toHaveBeenCalled();
   });

   it("keeps the server when the deletion cannot be recorded", async () => {
      state.recordWithin.mockRejectedValue(new Error("connection reset"));
      expect((await fetch(base, { method: "DELETE" })).status).toBe(500);
      expect(state.invalidate).not.toHaveBeenCalled();
   });

   it("answers 404 when the server vanished before the lock", async () => {
      state.previousName = null;
      expect((await fetch(base, { method: "DELETE" })).status).toBe(404);
      expect(state.serverDeleteMany).not.toHaveBeenCalled();
      expect(state.recordWithin).not.toHaveBeenCalled();
   });

   it("deletes nothing for an admin", async () => {
      state.role = "ADMIN";
      expect((await fetch(base, { method: "DELETE" })).status).toBe(403);
      expect(state.transaction).not.toHaveBeenCalled();
      expect(state.serverDeleteMany).not.toHaveBeenCalled();
      expect(state.recordWithin).not.toHaveBeenCalled();
   });
});

describe("POST /servers/:serverId/leave", () => {
   it("records the departure of a member", async () => {
      state.role = "EDITOR";
      const res = await fetch(`${base}/leave`, { method: "POST" });
      expect(res.status).toBe(204);
      expect(state.removeMembership).toHaveBeenCalledWith(ACTOR, SERVER);
      expect(state.recordMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [{ action: "server.leave" }]
      );
   });

   it("records the invites a departing member had sent as revoked", async () => {
      state.role = "ADMIN";
      const revokedInvites = [
         {
            action: "invite.revoke",
            target: "invitee@example.com",
            detail: { reason: "sender_authority" },
         },
      ];
      state.removeMembership.mockResolvedValue({
         email: "actor@example.com",
         revokedInvites,
      });
      const res = await fetch(`${base}/leave`, { method: "POST" });
      expect(res.status).toBe(204);
      expect(state.recordMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [{ action: "server.leave" }, ...revokedInvites]
      );
   });

   it("refuses an owner and records nothing", async () => {
      const res = await fetch(`${base}/leave`, { method: "POST" });
      expect(res.status).toBe(400);
      expect(state.removeMembership).not.toHaveBeenCalled();
      expect(state.recordMany).not.toHaveBeenCalled();
   });
});

describe("bounded server-list query validation", () => {
   it("keeps valid sort identities verbatim, including a leading Unicode marker", async () => {
      state.queryRaw.mockResolvedValue([]);
      const name = "\ufeff Name | unchanged ";
      const cursor = Buffer.from(`${name}|server123`).toString("base64url");
      expect((await fetch(`${root}?cursor=${cursor}`)).status).toBe(200);
      expect(bindings(state.queryRaw.mock.calls[0])).toEqual([
         ACTOR,
         name,
         "server123",
         SERVER_PAGE_SIZE + 1,
      ]);
   });

   it.each([
      "Name|bad\0id",
      "Bad\0Name|id",
      "x".repeat(65) + "|id",
      "Name|" + "i".repeat(65),
   ])("rejects invalid decoded positions before SQL", async (position) => {
      const cursor = Buffer.from(position).toString("base64url");
      expect((await fetch(`${root}?cursor=${cursor}`)).status).toBe(400);
      expect(state.queryRaw).not.toHaveBeenCalled();
   });
   it.each(["cursor=" + "a".repeat(513), "cursor=a&cursor=b"])(
      "rejects malformed query %s before SQL",
      async (query) => {
         expect((await fetch(`${root}?${query}`)).status).toBe(400);
         expect(state.queryRaw).not.toHaveBeenCalled();
      }
   );
});
