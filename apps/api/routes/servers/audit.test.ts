// imported first: the database mock factory below runs while later imports are still loading.
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import express from "express";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS, MINUTE_MS } from "@s3-viewer/types";
import { errorHandler } from "@/lib/http";
import { privateNoStore } from "@/lib/middleware/cache-control";
import { recordDenials } from "@/lib/middleware/route";
import { setAuditChainKey } from "@/lib/audit/chain";
import { flushAudits } from "@/lib/audit/writer";
import type { DbRole } from "@/lib/testing/scope-probe";

type DbLevel = "ALL" | "CHANGES";

const state = vi.hoisted(() => ({
   role: "OWNER" as DbRole | null,
   actorId: "actor12345",
   sessionCreatedAt: 0,
   server: {
      auditEnabled: true,
      auditViewRole: "ADMIN" as DbRole,
      auditManageRole: "ADMIN" as DbRole,
      auditRetentionDays: 0,
      auditLevel: "ALL" as DbLevel,
   },
   grants: [{ bucketName: "photos" }],
   locked: null as null | { auditEnabled: boolean },
   beforeSettingsLock: vi.fn(),
   findMany: vi.fn(),
   findFirst: vi.fn(),
   selectRows: vi.fn(),
   createMany: vi.fn(),
   headFind: vi.fn(),
   headUpsert: vi.fn(),
   update: vi.fn(),
   bulkLimit: vi.fn(),
   verifyLimit: vi.fn(),
}));

vi.mock("@/lib/middleware/rate-limit", () => ({
   auditBulkLimit: (_req: unknown, _res: unknown, next: () => void) => {
      state.bulkLimit();
      next();
   },
   auditSearchLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
   auditVerifyLimit: (_req: unknown, _res: unknown, next: () => void) => {
      state.verifyLimit();
      next();
   },
}));

vi.mock("@s3-viewer/db", () => {
   const auditLog = {
      findMany: state.findMany,
      findFirst: state.findFirst,
      createMany: state.createMany,
   };
   const auditChainHead = {
      findUnique: state.headFind,
      upsert: state.headUpsert,
   };
   return {
      prisma: {
         auditLog,
         auditChainHead,
         $queryRaw: scopeQueryRaw(
            () =>
               state.role
                  ? {
                       role: state.role,
                       ...state.server,
                       grants: state.grants.map(({ bucketName }) => ({
                          bucketName,
                          role: state.role as DbRole,
                       })),
                    }
                  : null,
            async (strings, ...values) => state.selectRows(strings, ...values)
         ),
         $transaction: (work: (tx: unknown) => Promise<unknown>) =>
            work({
               auditLog,
               auditChainHead,
               server: { update: state.update },
               serverAccess: {
                  findUnique: async () =>
                     state.role ? { role: state.role } : null,
               },
               $executeRaw: async () => 1,
               $queryRaw: async (
                  strings: TemplateStringsArray,
                  ...values: unknown[]
               ) => {
                  // text searches read the log inside a statement-timeout transaction.
                  if (
                     Prisma.sql(strings, ...values).text.includes('"audit_log"')
                  )
                     return state.selectRows(strings, ...values);
                  await state.beforeSettingsLock();
                  return [{ ...state.server, ...state.locked }];
               },
            }),
      },
   };
});

const { auditRouter } = await import("./audit");

let base: string;
let clock = new Date("2026-09-07T12:00:00.000Z").getTime();

beforeAll(() => {
   vi.useFakeTimers({ toFake: ["Date"] });
   setAuditChainKey(Buffer.from("audit-chain-test-key"));
});

routeServer(
   (app) => {
      app.use((req, _res, next) => {
         req.headers["sec-fetch-site"] = "same-origin";
         next();
      });
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actorId })));
      app.use((req, _res, next) => {
         Object.assign(req, {
            session: { createdAt: new Date(state.sessionCreatedAt) },
         });
         next();
      });
      app.use(privateNoStore);
      app.use("/servers", auditRouter);
      app.use(recordDenials);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/audit`;
   }
);

afterAll(() => {
   vi.useRealTimers();
});

const row = (
   id: string,
   at: string,
   overrides: { target?: string; actorEmail?: string; seq?: number } = {}
) => ({
   id,
   seq: 1,
   action: "object.delete",
   actorId: "actor12345",
   actorEmail: "actor@example.com",
   bucket: "photos",
   target: `${id},"quoted".png`,
   detail: { count: 2 },
   prevHash: "",
   hash: "abc123",
   createdAt: new Date(at),
   ...overrides,
});

const queryOf = (call: number): Prisma.Sql => {
   const [strings, ...values] = (state.selectRows.mock.calls[call] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

const queryText = (call: number): string =>
   queryOf(call).text.replace(/\s+/g, " ").trim();

const queryValues = (call: number): unknown[] => queryOf(call).values;

const recordedRows = async () => {
   await flushAudits();
   return state.createMany.mock.calls.flatMap(
      (call) => call[0].data as { action: string }[]
   );
};

const recorded = async () =>
   (await recordedRows()).map((entry) => entry.action);

const patchSettings = (body: Record<string, unknown>) =>
   fetch(`${base}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const defaults = {
   enabled: true,
   viewRole: "ADMIN",
   manageRole: "ADMIN",
   retentionDays: 0,
   level: "ALL",
};

const memberReach = '("bucket" IN ($2))';
const adminReach =
   '"bucket" = $2 ORDER BY "createdAt" DESC, "id" DESC LIMIT $3) UNION ALL ( SELECT';

beforeEach(async () => {
   await flushAudits();
   clock += 10 * MINUTE_MS;
   vi.setSystemTime(clock);
   state.role = "OWNER";
   state.actorId = "actor12345";
   state.sessionCreatedAt = clock;
   state.server = {
      auditEnabled: true,
      auditViewRole: "ADMIN",
      auditManageRole: "ADMIN",
      auditRetentionDays: 0,
      auditLevel: "ALL",
   };
   state.grants = [{ bucketName: "photos" }];
   state.locked = null;
   state.beforeSettingsLock.mockReset();
   state.bulkLimit.mockReset();
   state.verifyLimit.mockReset();
   state.findMany.mockReset().mockResolvedValue([]);
   state.findFirst.mockReset().mockResolvedValue(null);
   state.selectRows.mockReset().mockResolvedValue([]);
   state.createMany.mockReset().mockResolvedValue({ count: 1 });
   state.headFind.mockReset().mockResolvedValue(null);
   state.headUpsert.mockReset().mockResolvedValue({});
   state.update.mockReset().mockImplementation(async ({ data }) => ({
      auditEnabled: data.auditEnabled,
      auditViewRole: data.auditViewRole ?? state.server.auditViewRole,
      auditManageRole: data.auditManageRole ?? state.server.auditManageRole,
      auditRetentionDays:
         data.auditRetentionDays ?? state.server.auditRetentionDays,
      auditLevel: data.auditLevel ?? state.server.auditLevel,
   }));
});

describe("audit settings", () => {
   it("returns the server's settings to a member who may manage them", async () => {
      const res = await fetch(`${base}/settings`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ settings: defaults });
      state.role = "EDITOR";
      expect((await fetch(`${base}/settings`)).status).toBe(403);
      state.role = null;
      expect((await fetch(`${base}/settings`)).status).toBe(404);
   });

   it("saves and records the change even when the log is turned off", async () => {
      const res = await patchSettings({
         ...defaults,
         enabled: false,
         retentionDays: 90,
         level: "CHANGES",
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
         settings: {
            ...defaults,
            enabled: false,
            retentionDays: 90,
            level: "CHANGES",
         },
      });
      expect(state.update.mock.calls[0]?.[0]).toMatchObject({
         where: { id: "server12345" },
         data: {
            auditEnabled: false,
            auditViewRole: "ADMIN",
            auditManageRole: "ADMIN",
            auditRetentionDays: 90,
            auditLevel: "CHANGES",
         },
      });
      expect((await recordedRows())[0]).toMatchObject({
         serverId: "server12345",
         actorEmail: "actor@example.com",
         action: "audit.settings_change",
         detail: {
            ...defaults,
            enabled: false,
            retentionDays: 90,
            level: "CHANGES",
            wasEnabled: true,
            wasViewRole: "ADMIN",
            wasManageRole: "ADMIN",
            wasRetentionDays: 0,
            wasLevel: "ALL",
         },
      });
   });

   it("refuses a retention below the floor, and says what the floor is", async () => {
      const short = await patchSettings({ ...defaults, retentionDays: 30 });
      expect(short.status).toBe(400);
      expect((await short.json()).message).toContain("90 days");
      expect(state.update).not.toHaveBeenCalled();
      expect(await recordedRows()).toEqual([]);

      for (const retentionDays of [0, 90, 365])
         expect(
            (await patchSettings({ ...defaults, retentionDays })).status
         ).toBe(200);
   });

   it("commits the settings change and its audit row together", async () => {
      state.createMany.mockRejectedValue(new Error("connection reset"));
      const res = await patchSettings({ ...defaults, enabled: false });
      expect(res.status).toBe(500);
      expect(state.update).toHaveBeenCalledOnce();
   });

   it("lets a delegated admin turn the log back on, but never off", async () => {
      state.role = "ADMIN";
      const off = await patchSettings({ enabled: false });
      expect(off.status).toBe(403);
      expect(await off.json()).toEqual({
         message: "Only the owner can change that",
      });
      state.server.auditEnabled = false;
      expect((await patchSettings({ enabled: true })).status).toBe(200);
      expect((await patchSettings({ enabled: false })).status).toBe(200);
      expect(state.update.mock.calls[0]?.[0].data).toMatchObject({
         auditEnabled: true,
      });
      state.server.auditEnabled = true;
      for (const change of [
         { viewRole: "VIEWER" },
         { manageRole: "OWNER" },
         { retentionDays: 30 },
         { level: "CHANGES" },
      ]) {
         const res = await patchSettings({ ...defaults, ...change });
         expect(res.status).toBe(403);
         expect(await res.json()).toEqual({
            message: "Only the owner can change that",
         });
      }
      expect(state.update).toHaveBeenCalledTimes(2);
   });

   it("decides the owner-only rule on the locked row, not the gate's snapshot", async () => {
      state.role = "ADMIN";
      state.server.auditEnabled = false;
      state.locked = { auditEnabled: true };
      const res = await patchSettings({ enabled: false });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "Only the owner can change that",
      });
      expect(state.update).not.toHaveBeenCalled();

      expect((await recordedRows())[0]).toMatchObject({
         action: "access.denied",
      });
      state.createMany.mockClear();

      state.role = "OWNER";
      expect((await patchSettings({ enabled: false })).status).toBe(200);
      expect((await recordedRows())[0]).toMatchObject({
         action: "audit.settings_change",
         detail: { enabled: false, wasEnabled: true },
      });
   });

   it.each(["delegation revoked", "actor demoted", "membership removed"])(
      "refuses a previously admitted mutation after %s while waiting for the lock",
      async (change) => {
         state.role = "ADMIN";
         let reachedLock!: () => void;
         let resume!: () => void;
         const waiting = new Promise<void>((resolve) => {
            reachedLock = resolve;
         });
         const held = new Promise<void>((resolve) => {
            resume = resolve;
         });
         state.beforeSettingsLock.mockImplementationOnce(async () => {
            reachedLock();
            await held;
         });
         const response = patchSettings({ enabled: true });
         await waiting;
         if (change === "delegation revoked")
            state.server.auditManageRole = "OWNER";
         if (change === "actor demoted") state.role = "EDITOR";
         if (change === "membership removed") state.role = null;
         resume();
         expect((await response).status).toBe(403);
         expect(state.update).not.toHaveBeenCalled();
         expect(await recordedRows()).toEqual([
            expect.objectContaining({
               action: "access.denied",
               detail: { permission: "audit.manage", reason: "audit" },
            }),
         ]);
      }
   );

   it("cannot re-enable disabled auditing after delegation is revoked at the lock", async () => {
      state.role = "ADMIN";
      state.server.auditEnabled = false;
      state.beforeSettingsLock.mockImplementationOnce(() => {
         state.server.auditManageRole = "OWNER";
      });
      expect((await patchSettings({ enabled: true })).status).toBe(403);
      expect(state.update).not.toHaveBeenCalled();
      expect(await recordedRows()).toEqual([]);
   });

   it("needs a recent sign-in for an owner-only change, but not to turn the log back on", async () => {
      state.sessionCreatedAt = clock - 25 * 60 * MINUTE_MS;
      for (const change of [
         { enabled: false },
         { viewRole: "VIEWER" },
         { manageRole: "OWNER" },
         { retentionDays: 90 },
         { level: "CHANGES" },
      ]) {
         const res = await patchSettings({ ...defaults, ...change });
         expect(res.status).toBe(403);
         expect(await res.json()).toMatchObject({ code: "SESSION_STALE" });
      }
      expect(state.update).not.toHaveBeenCalled();
      expect(await recordedRows()).toEqual([]);

      expect((await patchSettings(defaults)).status).toBe(200);
      state.server.auditEnabled = false;
      expect((await patchSettings({ enabled: true })).status).toBe(200);
      state.role = "ADMIN";
      state.server.auditEnabled = true;
      expect(await (await patchSettings({ enabled: false })).json()).toEqual({
         message: "Only the owner can change that",
      });
   });

   it("validates the body", async () => {
      expect(
         (await patchSettings({ ...defaults, retentionDays: 4000 })).status
      ).toBe(400);
      expect(
         (await patchSettings({ ...defaults, manageRole: "VIEWER" })).status
      ).toBe(400);
      expect((await patchSettings({ ...defaults, level: "NONE" })).status).toBe(
         400
      );
   });

   it("records a member's refused attempt to manage the log", async () => {
      state.role = "EDITOR";
      const res = await fetch(`${base}/settings`);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You don't have permission to do that",
      });
      expect((await recordedRows())[0]).toMatchObject({
         serverId: "server12345",
         actorId: "actor12345",
         action: "access.denied",
         bucket: null,
         detail: { permission: "audit.manage", reason: "audit" },
      });
   });
});

describe("database-safe audit filters", () => {
   it.each(["actor", "bucket", "q"])(
      "rejects NUL in %s before listing or recording an export",
      async (filter) => {
         for (const path of ["", "/export"]) {
            const response = await fetch(`${base}${path}?${filter}=bad%00text`);
            expect(response.status).toBe(400);
         }
         expect(state.selectRows).not.toHaveBeenCalled();
         expect(await recordedRows()).toEqual([]);
      }
   );
});

describe("GET /servers/:serverId/audit", () => {
   it("returns the page and records one view per five minutes, cursor or not", async () => {
      state.selectRows.mockResolvedValue([
         row("row2", "2026-09-06T12:00:00.000Z"),
         row("row1", "2026-09-06T11:00:00.000Z"),
      ]);
      const page = await (await fetch(`${base}?limit=1`)).json();
      expect(state.bulkLimit).not.toHaveBeenCalled();
      expect(page.entries).toEqual([
         {
            id: "row2",
            action: "object.delete",
            actorId: "actor12345",
            actorEmail: "actor@example.com",
            bucket: "photos",
            target: 'row2,"quoted".png',
            detail: { count: 2 },
            createdAt: "2026-09-06T12:00:00.000Z",
         },
      ]);
      expect(page.nextCursor).toEqual(expect.any(String));
      expect(await recorded()).toEqual(["audit.view"]);

      const next = await fetch(`${base}?limit=1&cursor=${page.nextCursor}`);
      expect(next.status).toBe(200);
      expect((await fetch(`${base}?action=object`)).status).toBe(200);
      expect(await recorded()).toEqual(["audit.view"]);

      vi.setSystemTime(clock + 5 * MINUTE_MS + 1);
      const forged = Buffer.from("2026-09-06T12:00:00.000Z|row9").toString(
         "base64url"
      );
      expect((await fetch(`${base}?cursor=${forged}`)).status).toBe(200);
      expect(await recorded()).toEqual(["audit.view", "audit.view"]);
   });

   it("passes the filters through and confines non-owners to their reach", async () => {
      await fetch(
         `${base}?action=object&actor=user999&bucket=photos&q=png&from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z`
      );
      expect(queryValues(0)).toEqual([
         "server12345",
         AUDIT_ACTIONS.filter((action) => action.startsWith("object")),
         "user999",
         "photos",
         "%png%",
         "2026-09-01T00:00:00.000Z",
         "2026-09-30T23:59:59.999Z",
         51,
      ]);
      expect(queryText(0)).not.toContain('"bucket" IS NULL');
      expect(queryText(0)).not.toContain('"bucket" IN (');

      state.role = "ADMIN";
      await fetch(base);
      expect(queryText(1)).toContain(adminReach);
      expect(queryValues(1)).toEqual([
         "server12345",
         "photos",
         51,
         "server12345",
         ["credentials.update"],
         51,
         51,
      ]);

      state.role = "EDITOR";
      state.server.auditViewRole = "EDITOR";
      await fetch(base);
      expect(queryText(2)).toContain(memberReach);
   });

   it("still reads history while the log is off", async () => {
      state.server.auditEnabled = false;
      state.selectRows.mockResolvedValue([
         row("row1", "2026-09-06T11:00:00.000Z"),
      ]);
      const page = await (await fetch(base)).json();
      expect(page.entries).toHaveLength(1);
      expect(await recordedRows()).toEqual([]);
   });

   it("rejects a malformed cursor, a wildcard action, a member below viewRole, and a non-member", async () => {
      expect((await fetch(`${base}?cursor=notacursor`)).status).toBe(400);
      expect((await fetch(`${base}?action=object%25`)).status).toBe(400);
      expect((await fetch(`${base}?action=object_`)).status).toBe(200);
      expect((await fetch(`${base}?from=yesterday`)).status).toBe(400);
      expect((await fetch(`${base}?q=ab`)).status).toBe(400);
      state.role = "EDITOR";
      expect((await fetch(base)).status).toBe(403);
      state.server.auditViewRole = "EDITOR";
      expect((await fetch(base)).status).toBe(200);
      state.role = null;
      expect((await fetch(base)).status).toBe(404);
   });
});

describe("GET /servers/:serverId/audit/verify", () => {
   it("walks the chain for an admin, without recording a view", async () => {
      state.findMany.mockResolvedValue([]);
      state.role = "ADMIN";
      const res = await fetch(`${base}/verify`);
      expect(res.status).toBe(200);
      expect(state.verifyLimit).toHaveBeenCalledOnce();
      expect(state.bulkLimit).not.toHaveBeenCalled();
      expect(await res.json()).toEqual({
         ok: true,
         rows: 0,
         firstSeq: null,
         lastSeq: null,
         brokenAt: null,
         truncated: false,
         anchorSeq: null,
         nextFromSeq: null,
      });
      expect(state.findMany.mock.calls[0]?.[0]).toMatchObject({
         where: { serverId: "server12345" },
         orderBy: { seq: "asc" },
      });
      expect(state.findMany.mock.calls[0]?.[0].where.AND).toBeUndefined();
      expect(await recordedRows()).toEqual([]);
   });

   it("resumes from where a bounded pass stopped, and rejects a junk cursor", async () => {
      state.role = "ADMIN";
      state.findFirst.mockResolvedValue({ seq: 40, hash: "h40" });
      expect((await fetch(`${base}/verify?fromSeq=40`)).status).toBe(200);
      expect(state.findMany.mock.calls[0]?.[0]).toMatchObject({
         where: { serverId: "server12345", seq: { gt: 40 } },
      });
      expect((await fetch(`${base}/verify?fromSeq=-1`)).status).toBe(400);
      expect((await fetch(`${base}/verify?fromSeq=later`)).status).toBe(400);
   });

   it("refuses members below admin even when they may view the log", async () => {
      state.role = "VIEWER";
      expect((await fetch(`${base}/verify`)).status).toBe(403);
      state.role = null;
      expect((await fetch(`${base}/verify`)).status).toBe(404);
      state.role = "EDITOR";
      state.server.auditViewRole = "EDITOR";
      expect((await fetch(base)).status).toBe(200);
      const res = await fetch(`${base}/verify`);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "You don't have permission to do that",
      });
      expect(await recorded()).toEqual([
         "access.denied",
         "audit.view",
         "access.denied",
      ]);
      expect((await recordedRows())[2]).toMatchObject({
         actorId: "actor12345",
         action: "access.denied",
         detail: { permission: "audit.verify", reason: "audit" },
      });
   });
});

describe("GET /servers/:serverId/audit/export", () => {
   it("streams an uncacheable csv attachment and records the export with its filters", async () => {
      state.selectRows.mockResolvedValue([
         row("row2", "2026-09-06T12:00:00.000Z", { seq: 2 }),
         row("=row1", "2026-09-06T11:00:00.000Z"),
      ]);
      const res = await fetch(`${base}/export?bucket=photos`);
      expect(res.status).toBe(200);
      expect(state.bulkLimit).toHaveBeenCalledOnce();
      expect(state.verifyLimit).not.toHaveBeenCalled();
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(res.headers.get("content-disposition")).toMatch(
         /^attachment; filename="audit-server12345-\d{4}-\d{2}-\d{2}\.csv"$/
      );
      expect((await res.text()).split("\r\n")).toEqual([
         '"seq","createdAt","actorEmail","actorId","action","bucket","target","detail","prevHash","hash"',
         '"2","2026-09-06T12:00:00.000Z","actor@example.com","actor12345","object.delete","photos","row2,""quoted"".png","{""count"":2}","","abc123"',
         '"1","2026-09-06T11:00:00.000Z","actor@example.com","actor12345","object.delete","photos","\'=row1,""quoted"".png","{""count"":2}","","abc123"',
         "",
      ]);
      expect(queryValues(0)).toEqual(["server12345", "photos", 1000]);
      expect((await recordedRows())[0]).toMatchObject({
         action: "audit.export",
         detail: {
            action: null,
            actor: null,
            bucket: "photos",
            q: null,
            from: null,
            to: null,
         },
      });
   });

   it("refuses the export, writing nothing, when the export cannot be recorded", async () => {
      state.createMany.mockRejectedValue(new Error("connection reset"));
      const res = await fetch(`${base}/export`);
      expect(res.status).toBe(503);
      expect(res.headers.get("content-type")).not.toContain("text/csv");
      expect(state.selectRows).not.toHaveBeenCalled();
   });

   it("neutralises every formula prefix, in the actor column too", async () => {
      const at = "2026-09-06T12:00:00.000Z";
      state.selectRows.mockResolvedValue([
         row("plus", at, { target: "+sum" }),
         row("minus", at, { target: "-sum" }),
         row("at", at, { target: "@sum" }),
         row("tab", at, { target: "\tsum" }),
         row("cr", at, { target: "\rsum" }),
         row("email", at, { target: "safe", actorEmail: "=cmd()@x.com" }),
      ]);
      const lines = (await (await fetch(`${base}/export`)).text()).split(
         "\r\n"
      );
      expect(lines[1]).toContain(',"\'+sum",');
      expect(lines[2]).toContain(',"\'-sum",');
      expect(lines[3]).toContain(',"\'@sum",');
      expect(lines[4]).toContain(',"\'\tsum",');
      expect(lines[5]).toContain(',"\'\rsum",');
      expect(lines[6]).toContain('"\'=cmd()@x.com"');
      expect(lines[6]).toContain(',"safe",');
   });

   it("confines a non-owner's export to their reach", async () => {
      state.role = "ADMIN";
      expect((await fetch(`${base}/export`)).status).toBe(200);
      expect(queryText(0)).toContain(adminReach);
   });

   it("cuts a long export off with a closing row that says so", async () => {
      state.selectRows.mockImplementationOnce(async () => {
         clock += 16 * MINUTE_MS;
         vi.setSystemTime(clock);
         return [row("late", "2026-09-06T12:00:00.000Z")];
      });
      const res = await fetch(`${base}/export`);
      expect(res.status).toBe(200);
      const lines = (await res.text()).split("\r\n");
      expect(lines).toHaveLength(3);
      expect(lines[1]).toMatch(/^"","","","","export\.truncated",.*15 minutes/);
      expect(state.selectRows).toHaveBeenCalledOnce();
   });

   it("runs one export per user and two per server at a time", async () => {
      state.role = "VIEWER";
      state.server.auditViewRole = "VIEWER";
      const held = Promise.withResolvers<unknown[]>();
      state.selectRows.mockImplementationOnce(() => held.promise);
      const first = await fetch(`${base}/export`);
      expect(first.status).toBe(200);

      const again = await fetch(`${base}/export`);
      expect(again.status).toBe(429);
      expect(await again.json()).toMatchObject({
         code: "RATE_LIMITED",
         message: expect.stringContaining("You already have"),
      });

      state.actorId = "second12345";
      state.selectRows.mockImplementationOnce(() => held.promise);
      const second = await fetch(`${base}/export`);
      expect(second.status).toBe(200);
      state.actorId = "third123456";
      const third = await fetch(`${base}/export`);
      expect(third.status).toBe(429);
      expect(await third.json()).toMatchObject({
         message: expect.stringContaining("Other exports"),
      });

      held.resolve([]);
      await Promise.all([first.text(), second.text()]);
      const after = await fetch(`${base}/export`);
      expect(after.status).toBe(200);
      await after.text();
   });

   it("never locks the log's managers out behind viewers' exports", async () => {
      state.role = "VIEWER";
      state.server.auditViewRole = "VIEWER";
      const held = Promise.withResolvers<unknown[]>();
      const streams = [];
      for (const actorId of ["viewer1234a", "viewer1234b"]) {
         state.actorId = actorId;
         state.selectRows.mockImplementationOnce(() => held.promise);
         streams.push(await fetch(`${base}/export`));
      }
      expect(streams.map((res) => res.status)).toEqual([200, 200]);

      for (const role of ["OWNER", "ADMIN"] as const) {
         state.role = role;
         state.actorId = `${role.toLowerCase()}12345`;
         const res = await fetch(`${base}/export`);
         expect(res.status).toBe(200);
         await res.text();
      }

      held.resolve([]);
      await Promise.all(streams.map((res) => res.text()));
   });

   it("frees the slot when the client walks away mid-export", async () => {
      const held = Promise.withResolvers<unknown[]>();
      state.selectRows.mockImplementationOnce(() => held.promise);
      const aborted = new AbortController();
      const first = await fetch(`${base}/export`, { signal: aborted.signal });
      expect(first.status).toBe(200);
      aborted.abort();
      await vi.waitFor(async () => {
         const res = await fetch(`${base}/export`);
         await res.text();
         expect(res.status).toBe(200);
      });
      held.resolve([]);
   });

   it("is gated like the log itself", async () => {
      state.role = "VIEWER";
      expect((await fetch(`${base}/export`)).status).toBe(403);
   });
});
