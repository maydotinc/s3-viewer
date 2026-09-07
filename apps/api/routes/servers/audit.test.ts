import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { errorHandler } from "@/lib/http";

const state = vi.hoisted(() => ({
   role: "ADMIN" as "OWNER" | "ADMIN" | "VIEWER" | null,
   rows: [] as {
      id: string;
      action: string;
      actorId: string | null;
      target: string | null;
      createdAt: Date;
   }[],
   findMany: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: {
         findUnique: async () =>
            state.role
               ? {
                    role: state.role,
                    server: {
                       allowedBuckets: [],
                       restrictedBuckets: false,
                       bucketAccess: [],
                    },
                 }
               : null,
      },
      auditLog: { findMany: state.findMany },
      user: {
         findMany: async () => [
            { id: "actor12345", email: "actor@example.com", name: "Actor" },
         ],
      },
   },
}));

const { auditRouter } = await import("./audit");

let server: ReturnType<typeof createServer>;
let base: string;

beforeAll(async () => {
   const app = express();
   app.use((req, _res, next) => {
      req.user = {
         id: "actor12345",
         email: "actor@example.com",
         emailVerified: true,
         name: "Actor",
         createdAt: new Date(),
         updatedAt: new Date(),
      };
      next();
   });
   app.use("/servers", auditRouter);
   app.use(errorHandler);
   server = createServer(app);
   await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });
   base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/servers/server12345/audit`;
});

afterAll(async () => {
   if (!server) return;
   server.closeAllConnections();
   await new Promise<void>((resolve) => server.close(() => resolve()));
});

const row = (id: string, actorId: string | null, at: string) => ({
   id,
   action: "member.role_change",
   actorId,
   target: "member999",
   createdAt: new Date(at),
});

beforeEach(() => {
   state.role = "ADMIN";
   state.findMany.mockReset().mockResolvedValue([]);
});

describe("GET /servers/:serverId/audit", () => {
   it("returns entries newest first with the actor resolved", async () => {
      state.findMany.mockResolvedValue([
         row("row2", "actor12345", "2026-09-06T12:00:00.000Z"),
         row("row1", "deleted123", "2026-09-06T11:00:00.000Z"),
      ]);
      const body = await (await fetch(base)).json();
      expect(body.nextCursor).toBeNull();
      expect(body.entries).toEqual([
         {
            id: "row2",
            action: "member.role_change",
            actorId: "actor12345",
            actorEmail: "actor@example.com",
            actorName: "Actor",
            target: "member999",
            createdAt: "2026-09-06T12:00:00.000Z",
         },
         {
            id: "row1",
            action: "member.role_change",
            actorId: "deleted123",
            actorEmail: null,
            actorName: null,
            target: "member999",
            createdAt: "2026-09-06T11:00:00.000Z",
         },
      ]);
      expect(state.findMany.mock.calls[0]?.[0]).toMatchObject({
         where: { serverId: "server12345" },
         take: 51,
      });
   });

   it("hands back a cursor only when another page exists, and reads it back", async () => {
      state.findMany.mockResolvedValue([
         row("row2", null, "2026-09-06T12:00:00.000Z"),
         row("row1", null, "2026-09-06T11:00:00.000Z"),
      ]);
      const page = await (await fetch(`${base}?limit=1`)).json();
      expect(page.entries).toHaveLength(1);
      expect(page.nextCursor).toBe(
         Buffer.from("2026-09-06T12:00:00.000Z|row2", "utf8").toString(
            "base64url"
         )
      );

      await fetch(`${base}?limit=1&cursor=${page.nextCursor}`);
      expect(state.findMany.mock.calls[1]?.[0].where).toEqual({
         serverId: "server12345",
         OR: [
            { createdAt: { lt: new Date("2026-09-06T12:00:00.000Z") } },
            {
               createdAt: new Date("2026-09-06T12:00:00.000Z"),
               id: { lt: "row2" },
            },
         ],
      });
   });

   it("rejects a malformed cursor and a member without MANAGE_MEMBERS", async () => {
      expect((await fetch(`${base}?cursor=notacursor`)).status).toBe(400);
      state.role = "VIEWER";
      expect((await fetch(base)).status).toBe(403);
   });
});
