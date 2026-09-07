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

const state = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      auditLog: { findMany: state.findMany, create: async () => ({}) },
      user: {
         findMany: async () => [
            { id: "actor12345", email: "actor@example.com", name: "Actor" },
         ],
      },
   },
}));
vi.mock("@s3-viewer/auth", () => ({ auth: { api: { setPassword: vi.fn() } } }));
vi.mock("@/lib/services/account", () => ({ accountSummary: async () => ({}) }));

const { accountRouter } = await import("./account");

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
   app.use("/account", accountRouter);
   app.use(errorHandler);
   server = createServer(app);
   await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });
   base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/account/audit`;
});

afterAll(async () => {
   if (!server) return;
   server.closeAllConnections();
   await new Promise<void>((resolve) => server.close(() => resolve()));
});

const row = (id: string, at: string) => ({
   id,
   action: "auth.sign_in",
   actorId: "actor12345",
   target: "password",
   createdAt: new Date(at),
});

beforeEach(() => {
   state.findMany.mockReset().mockResolvedValue([]);
});

describe("GET /account/audit", () => {
   it("scopes the page to the caller and resolves the actor", async () => {
      state.findMany.mockResolvedValue([
         row("row2", "2026-09-06T12:00:00.000Z"),
         row("row1", "2026-09-06T11:00:00.000Z"),
      ]);
      const body = await (await fetch(base)).json();
      expect(body.nextCursor).toBeNull();
      expect(body.entries).toEqual([
         {
            id: "row2",
            action: "auth.sign_in",
            actorId: "actor12345",
            actorEmail: "actor@example.com",
            actorName: "Actor",
            target: "password",
            createdAt: "2026-09-06T12:00:00.000Z",
         },
         {
            id: "row1",
            action: "auth.sign_in",
            actorId: "actor12345",
            actorEmail: "actor@example.com",
            actorName: "Actor",
            target: "password",
            createdAt: "2026-09-06T11:00:00.000Z",
         },
      ]);
      // never a serverId: the caller's own rows are the whole scope
      expect(state.findMany.mock.calls[0]?.[0]).toMatchObject({
         where: { actorId: "actor12345" },
         take: 51,
      });
   });

   it("pages with the same cursor contract as the server audit route", async () => {
      state.findMany.mockResolvedValue([
         row("row2", "2026-09-06T12:00:00.000Z"),
         row("row1", "2026-09-06T11:00:00.000Z"),
      ]);
      const page = await (await fetch(`${base}?limit=1`)).json();
      expect(page.nextCursor).toBe(
         Buffer.from("2026-09-06T12:00:00.000Z|row2", "utf8").toString(
            "base64url"
         )
      );
      await fetch(`${base}?limit=1&cursor=${page.nextCursor}`);
      expect(state.findMany.mock.calls[1]?.[0].where).toEqual({
         actorId: "actor12345",
         OR: [
            { createdAt: { lt: new Date("2026-09-06T12:00:00.000Z") } },
            {
               createdAt: new Date("2026-09-06T12:00:00.000Z"),
               id: { lt: "row2" },
            },
         ],
      });
   });

   it("rejects a malformed cursor", async () => {
      expect((await fetch(`${base}?cursor=notacursor`)).status).toBe(400);
   });
});
