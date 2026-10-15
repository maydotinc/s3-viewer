import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS } from "@s3-viewer/types";
import {
   KEY,
   fakeRes,
   hmac,
   resetAuditMocks,
   serveChain,
   storedRows,
   useAuditClock,
   whole,
   type Stored,
} from "./audit.fixture";

const h = await vi.hoisted(async () =>
   (await import("./audit.fixture")).auditMocks()
);

vi.mock("@s3-viewer/db", async () =>
   (await import("./audit.fixture")).auditDatabase(h)
);
vi.mock("@/lib/logger", () => ({
   logger: { warn: h.warn, error: h.error },
}));

const { setAuditChainKey } = await import("./chain");
const { flushAudits } = await import("./writer");
const { iterateAudit, listAuditPage, verifyAuditChain } = await import(
   "./query"
);
const { recordMany } = await import("@/lib/middleware/audit-record");

const row = (id: string, at: string, seq = 1) => ({
   id,
   seq,
   action: "object.delete",
   actorId: "actor12345",
   actorEmail: "actor@example.com",
   bucket: "photos",
   target: `${id}.png`,
   detail: { count: 1 },
   prevHash: "",
   hash: "h",
   createdAt: new Date(at),
});

const stored = (): Stored[] => storedRows(h);

const written = async (queued: Promise<void>): Promise<void> => {
   await queued;
   await flushAudits();
};

const query = (call = 0): Prisma.Sql => {
   const [strings, ...values] = (h.selectRows.mock.calls[call] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

const queryText = (call = 0): string =>
   query(call).text.replace(/\s+/g, " ").trim();

const COLUMNS =
   '"id", "seq", "action", "actorId", "actorEmail", "bucket", "target",' +
   ' "detail", "prevHash", "hash", "createdAt"';

const seek = (
   server: number,
   bucket: string,
   action: number,
   take: number
): string =>
   `( SELECT ${COLUMNS} FROM "audit_log" WHERE "serverId" = $${server}` +
   ` AND ${bucket} AND "action" = ANY($${action}::text[])` +
   ` ORDER BY "createdAt" DESC, "id" DESC LIMIT $${take})`;

const OBJECT_ACTIONS = AUDIT_ACTIONS.filter((action) =>
   action.startsWith("object")
);

const SERVER_ROWS = (param: number): string =>
   `("bucket" IS NULL AND "action" <> ALL($${param}::text[]))`;

useAuditClock(setAuditChainKey);

beforeEach(async () => {
   await flushAudits();
   resetAuditMocks(h);
   h.headUpsert.mockImplementation(async ({ create }) => {
      h.headFind.mockResolvedValue(create);
      return create;
   });
});

describe("verifyAuditChain", () => {
   const chain = async (): Promise<Stored[]> => {
      await written(
         recordMany(
            fakeRes(true),
            Array.from({ length: 5 }, (_, i) => ({
               action: "object.delete" as const,
               bucket: "photos",
               target: `${i}.png`,
               detail: { count: i, dryRun: false },
            }))
         )
      );
      return stored();
   };

   it("reports an empty log as intact", async () => {
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         ok: true,
         rows: 0,
         firstSeq: null,
         lastSeq: null,
         brokenAt: null,
      });
   });

   it("detects a modified row", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.map((r) => (r.seq === 3 ? { ...r, target: "x" } : r))
      );
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         ok: false,
         rows: 3,
         firstSeq: 1,
         lastSeq: 3,
         brokenAt: 3,
      });
   });

   it("detects a removed middle row", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((r) => r.seq !== 3)
      );
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         brokenAt: 4,
      });
   });

   it("detects a row rewritten with a fresh hash, with or without the key", async () => {
      const rows = await chain();
      const forge = (key: Buffer) =>
         rows.map((r) => {
            if (r.seq !== 3) return r;
            const target = "x";
            const content = JSON.stringify([
               r.serverId,
               r.seq,
               r.actorId,
               r.actorEmail,
               r.action,
               r.bucket,
               target,
               '{"count":2,"dryRun":false}',
               r.createdAt.toISOString(),
               r.prevHash,
            ]);
            return { ...r, target, hash: hmac(content, key) };
         });
      serveChain(h, forge(KEY));
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         brokenAt: 4,
      });
      serveChain(h, forge(Buffer.from("guessed")));
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         brokenAt: 3,
      });
   });

   it("rejects a deleted prefix without a matching retention watermark", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((row) => row.seq > 2)
      );
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 0,
      });
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         brokenAt: 3,
      });
   });

   it("keeps an append after the snapshot from changing its anchor", async () => {
      const rows = await chain();
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 0,
      });
      h.findMany.mockImplementation(async () => {
         h.headFind.mockResolvedValue({
            seq: 6,
            hash: "new append",
            prunedThroughSeq: 0,
         });
         return rows;
      });
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: true,
         anchorSeq: 5,
         rows: 5,
      });
      expect(h.transaction).toHaveBeenLastCalledWith({
         isolationLevel: "RepeatableRead",
         timeout: 30_000,
      });
   });

   it("keeps pruning between read batches outside the verification snapshot", async () => {
      await written(
         recordMany(
            fakeRes(true),
            Array.from({ length: 1001 }, () => ({ action: "object.delete" }))
         )
      );
      const snapshot = stored();
      const last = snapshot.at(-1);
      h.headFind.mockResolvedValue({
         seq: last?.seq,
         hash: last?.hash,
         prunedThroughSeq: 0,
      });
      h.findMany.mockImplementation(
         async ({
            where,
            take,
         }: {
            where: { seq?: { gt: number } };
            take: number;
         }) => {
            h.headFind.mockResolvedValue({
               seq: last?.seq,
               hash: last?.hash,
               prunedThroughSeq: 1001,
            });
            return snapshot
               .filter((row) => row.seq > (where.seq?.gt ?? 0))
               .slice(0, take);
         }
      );
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: true,
         rows: 1001,
         firstSeq: 1,
         lastSeq: 1001,
      });
      expect(h.headFind).toHaveBeenLastCalledWith({
         where: { serverId: "server12345" },
         select: { seq: true, hash: true, prunedThroughSeq: true },
      });
      expect(h.transaction).toHaveBeenLastCalledWith({
         isolationLevel: "RepeatableRead",
         timeout: 30_000,
      });
   });

   it("resumes at the retained boundary after pruning consumes its seed", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((row) => row.seq > 3)
      );
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 3,
      });
      expect(
         await verifyAuditChain("server12345", undefined, { fromSeq: 2 })
      ).toMatchObject({ ok: true, firstSeq: 4, rows: 2 });
   });

   it("does not silently restart when a resume seed disappeared without pruning", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((row) => row.seq !== 2)
      );
      h.findFirst.mockResolvedValue(null);
      expect(
         await verifyAuditChain("server12345", undefined, { fromSeq: 2 })
      ).toMatchObject({ ok: false, brokenAt: 2, rows: 0 });
   });

   it("passes after retention pruned the oldest rows", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((r) => r.seq > 2)
      );
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 2,
      });
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         ok: true,
         rows: 3,
         firstSeq: 3,
         lastSeq: 5,
         anchorSeq: 5,
         brokenAt: null,
      });
      expect(h.findMany.mock.calls[0]?.[0]).toMatchObject({
         where: { serverId: "server12345" },
         orderBy: { seq: "asc" },
         take: 1000,
      });
   });

   it("stops after the current batch once the caller has gone", async () => {
      await written(
         recordMany(
            fakeRes(true),
            Array.from({ length: 1500 }, () => ({
               action: "bucket.create" as const,
            }))
         )
      );
      serveChain(h, stored());
      expect(await verifyAuditChain("server12345", { closed: true })).toEqual({
         ...whole,
         ok: true,
         rows: 1000,
         firstSeq: 1,
         lastSeq: 1000,
         brokenAt: null,
         nextFromSeq: 1000,
      });
      expect(h.findMany).toHaveBeenCalledOnce();
   });

   it("detects rows deleted off the end, which the chain alone cannot", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((r) => r.seq <= 3)
      );
      h.headFind.mockResolvedValue({ seq: 5, hash: rows[4]?.hash });
      expect(await verifyAuditChain("server12345")).toEqual({
         ok: false,
         rows: 3,
         firstSeq: 1,
         lastSeq: 3,
         brokenAt: null,
         truncated: true,
         anchorSeq: 5,
         nextFromSeq: null,
      });
   });

   it("passes after retention pruned every row the anchor names", async () => {
      const rows = await chain();
      serveChain(h, []);
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 5,
      });
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         ok: true,
         rows: 0,
         firstSeq: null,
         lastSeq: null,
         anchorSeq: 5,
         brokenAt: null,
      });
   });

   it("still detects rows deleted past what pruning claims", async () => {
      const rows = await chain();
      serveChain(
         h,
         rows.filter((r) => r.seq > 2 && r.seq <= 3)
      );
      h.headFind.mockResolvedValue({
         seq: 5,
         hash: rows[4]?.hash,
         prunedThroughSeq: 2,
      });
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         truncated: true,
         lastSeq: 3,
         anchorSeq: 5,
      });
      serveChain(h, []);
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         truncated: true,
         lastSeq: null,
         anchorSeq: 5,
      });
   });

   it("passes a server that has never written a row", async () => {
      serveChain(h, []);
      h.headFind.mockResolvedValue(null);
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         ok: true,
         rows: 0,
         firstSeq: null,
         lastSeq: null,
         brokenAt: null,
      });
   });

   it("detects a last row rewritten by someone holding the key", async () => {
      const rows = await chain();
      serveChain(h, rows);
      h.headFind.mockResolvedValue({ seq: 5, hash: "what it used to be" });
      expect(await verifyAuditChain("server12345")).toMatchObject({
         ok: false,
         truncated: true,
         lastSeq: 5,
         anchorSeq: 5,
      });
   });

   it.each([
      { fromSeq: 0, maxRows: 100, retained: 5, closed: false },
      { fromSeq: 0, maxRows: 100, retained: 3, closed: false },
      { fromSeq: 0, maxRows: 1, retained: 5, closed: false },
      { fromSeq: 0, maxRows: 100, retained: 5, closed: true },
      { fromSeq: 5, maxRows: 100, retained: 5, closed: false },
   ])(
      "refuses an unanchored existing chain for window %j",
      async ({ fromSeq, maxRows, retained, closed }) => {
         const rows = await chain();
         serveChain(
            h,
            rows.filter((row) => row.seq <= retained)
         );
         h.headFind.mockResolvedValue(null);
         h.findFirst.mockResolvedValue(
            rows.find((row) => row.seq === fromSeq) ?? null
         );
         expect(
            await verifyAuditChain(
               "server12345",
               { closed },
               { fromSeq, maxRows }
            )
         ).toMatchObject({
            ok: false,
            brokenAt: null,
            truncated: false,
            anchorSeq: null,
            nextFromSeq: null,
         });
      }
   );

   it("verifies a window at a time and hands back where to resume", async () => {
      const rows = await chain();
      serveChain(h, rows);
      const first = await verifyAuditChain("server12345", undefined, {
         maxRows: 2,
      });
      expect(first).toEqual({
         ok: true,
         rows: 2,
         firstSeq: 1,
         lastSeq: 2,
         brokenAt: null,
         truncated: false,
         anchorSeq: null,
         nextFromSeq: 2,
      });
      expect(h.findMany.mock.calls[0]?.[0]).toMatchObject({ take: 2 });

      h.findFirst.mockResolvedValue({ seq: 2, hash: rows[1]?.hash });
      h.headFind.mockResolvedValue({ seq: 5, hash: rows[4]?.hash });
      expect(
         await verifyAuditChain("server12345", undefined, {
            fromSeq: first.nextFromSeq ?? 0,
         })
      ).toEqual({
         ok: true,
         rows: 3,
         firstSeq: 3,
         lastSeq: 5,
         brokenAt: null,
         truncated: false,
         anchorSeq: 5,
         nextFromSeq: null,
      });
   });

   it("checks the seam a resumed pass starts on", async () => {
      const rows = await chain();
      serveChain(h, rows);
      h.findFirst.mockResolvedValue({ seq: 2, hash: "someone else's hash" });
      expect(
         await verifyAuditChain("server12345", undefined, { fromSeq: 2 })
      ).toMatchObject({ ok: false, brokenAt: 3, rows: 1 });
   });

   it("runs one verification per server and four across servers", async () => {
      const held = Promise.withResolvers<void>();
      h.findMany.mockImplementation(async () => {
         await held.promise;
         return [];
      });
      const first = verifyAuditChain("server12345");
      await expect(verifyAuditChain("server12345")).rejects.toMatchObject({
         status: 429,
         code: "RATE_LIMITED",
         message: expect.stringMatching(/on this server/),
      });
      const others = ["server2", "server3", "server4"].map((id) =>
         verifyAuditChain(id)
      );
      await expect(verifyAuditChain("server5")).rejects.toMatchObject({
         status: 429,
         message: expect.stringMatching(/Too many integrity checks/),
      });
      held.resolve();
      await Promise.all([first, ...others]);
      h.findMany.mockResolvedValue([]);
      await expect(verifyAuditChain("server12345")).resolves.toMatchObject({
         ok: true,
      });
   });

   it("runs one verification per person, whichever server it is on", async () => {
      const held = Promise.withResolvers<void>();
      h.findMany.mockImplementation(async () => {
         await held.promise;
         return [];
      });
      const first = verifyAuditChain("server1", undefined, {}, "owner12345");
      await expect(
         verifyAuditChain("server2", undefined, {}, "owner12345")
      ).rejects.toMatchObject({
         status: 429,
         message: expect.stringMatching(/earlier integrity check/),
      });
      const other = verifyAuditChain("server2", undefined, {}, "owner67890");
      held.resolve();
      await Promise.all([first, other]);
      await expect(
         verifyAuditChain("server2", undefined, {}, "owner12345")
      ).resolves.toMatchObject({ ok: true });
   });
});

describe("listAuditPage", () => {
   it("builds the filter and hands back a cursor only when more rows exist", async () => {
      h.selectRows.mockResolvedValue([
         row("row2", "2026-09-06T12:00:00.000Z", 2),
         row("row1", "2026-09-06T11:00:00.000Z", 1),
      ]);
      const from = new Date("2026-09-01T00:00:00.000Z");
      const to = new Date("2026-09-30T23:59:59.999Z");
      const page = await listAuditPage({
         serverId: "server12345",
         reach: null,
         limit: 1,
         action: "object",
         actor: "actor12345",
         bucket: "photos",
         q: "row",
         from,
         to,
      });
      expect(page.entries).toEqual([
         {
            id: "row2",
            action: "object.delete",
            actorId: "actor12345",
            actorEmail: "actor@example.com",
            bucket: "photos",
            target: "row2.png",
            detail: { count: 1 },
            createdAt: "2026-09-06T12:00:00.000Z",
         },
      ]);
      expect(page.nextCursor).toBe(
         Buffer.from("2026-09-06T12:00:00.000Z|row2").toString("base64url")
      );
      expect(queryText()).toContain(
         'WHERE "serverId" = $1 AND "action" = ANY($2::text[]) AND "actorId" = $3' +
            ' AND "bucket" = $4 AND "target" ILIKE $5 AND "createdAt" >= $6::timestamp' +
            ' AND "createdAt" <= $7::timestamp ORDER BY "createdAt" DESC, "id" DESC LIMIT $8'
      );
      expect(query().values).toEqual([
         "server12345",
         OBJECT_ACTIONS,
         "actor12345",
         "photos",
         "%row%",
         from.toISOString(),
         to.toISOString(),
         2,
      ]);

      await listAuditPage({
         serverId: "server12345",
         reach: null,
         limit: 1,
         cursor: page.nextCursor ?? "",
      });
      expect(queryText(1)).toContain(
         'WHERE "serverId" = $1 AND ("createdAt", "id") < ($2::timestamp, $3)'
      );
      expect(query(1).values).toEqual([
         "server12345",
         "2026-09-06T12:00:00.000Z",
         "row2",
         2,
      ]);
   });

   it("bounds the range on one side only when just from or to is given", async () => {
      const from = new Date("2026-09-01T00:00:00.000Z");
      await listAuditPage({ serverId: "s", reach: null, limit: 1, from });
      expect(queryText()).toContain('AND "createdAt" >= $2');
      expect(queryText()).not.toContain('"createdAt" <=');
      await listAuditPage({ serverId: "s", reach: null, limit: 1 });
      expect(queryText(1)).not.toContain('"createdAt"  >=');
      expect(query(1).values).toEqual(["s", 2]);
   });

   it("names the actions an action prefix covers, and matches a search literally", async () => {
      await listAuditPage({
         serverId: "s",
         reach: null,
         limit: 1,
         action: "object.m",
         q: "100%_",
      });
      expect(query().values).toEqual([
         "s",
         ["object.move", "object.multipart_abort"],
         "%100\\%\\_%",
         2,
      ]);

      await listAuditPage({
         serverId: "s",
         reach: null,
         limit: 1,
         action: "object_",
      });
      expect(query(1).values).toEqual(["s", [], 2]);
   });

   it("confines non-owners to their one bucket, and reaches nothing without a grant", async () => {
      await listAuditPage({
         serverId: "server12345",
         reach: {
            buckets: ["photos"],
            ownBuckets: [],
            actorId: "user1",
            serverWide: false,
         },
         limit: 1,
      });
      await listAuditPage({
         serverId: "server12345",
         reach: {
            buckets: [],
            ownBuckets: [],
            actorId: "user1",
            serverWide: false,
         },
         limit: 1,
      });
      expect(queryText()).toContain('AND ("bucket" IN ($2))');
      expect(queryText(1)).toContain("AND false");
   });

   it("seeks each reachable bucket on its own and merges their heads", async () => {
      await listAuditPage({
         serverId: "server12345",
         reach: {
            buckets: ["photos", "docs"],
            ownBuckets: [],
            actorId: "user1",
            serverWide: true,
         },
         limit: 1,
         action: "object",
      });
      expect(queryText()).toBe(
         `SELECT ${COLUMNS} FROM (` +
            seek(1, '"bucket" = $2', 3, 4) +
            " UNION ALL " +
            seek(5, '"bucket" = $6', 7, 8) +
            " UNION ALL " +
            seek(9, `${SERVER_ROWS(10)}`, 11, 12) +
            `) AS "reach" ORDER BY "createdAt" DESC, "id" DESC LIMIT $13`
      );
      expect(query().values).toEqual([
         "server12345",
         "photos",
         OBJECT_ACTIONS,
         2,
         "server12345",
         "docs",
         OBJECT_ACTIONS,
         2,
         "server12345",
         ["credentials.update"],
         OBJECT_ACTIONS,
         2,
         2,
      ]);
   });

   it("gives the caller's own activity in folder-limited buckets a seek of its own", async () => {
      await listAuditPage({
         serverId: "server12345",
         reach: {
            buckets: ["photos", "docs"],
            ownBuckets: ["company", "shared"],
            actorId: "user1",
            serverWide: false,
         },
         limit: 1,
         action: "object",
      });
      expect(queryText()).toBe(
         `SELECT ${COLUMNS} FROM (` +
            seek(1, '"bucket" = $2', 3, 4) +
            " UNION ALL " +
            seek(5, '"bucket" = $6', 7, 8) +
            " UNION ALL " +
            seek(9, '("bucket" IN ($10,$11) AND "actorId" = $12)', 13, 14) +
            `) AS "reach" ORDER BY "createdAt" DESC, "id" DESC LIMIT $15`
      );
      expect(query().values.slice(8, 12)).toEqual([
         "server12345",
         "company",
         "shared",
         "user1",
      ]);
   });

   it("confines a folder-limited bucket to the caller's own rows in a single seek", async () => {
      const reach = {
         buckets: [],
         ownBuckets: ["company"],
         actorId: "user1",
         serverWide: false,
      };
      await listAuditPage({ serverId: "server12345", reach, limit: 1 });
      await listAuditPage({
         serverId: "server12345",
         reach,
         limit: 1,
         bucket: "company",
      });
      expect(queryText(0)).not.toContain("UNION ALL");
      expect(queryText(0)).toContain(
         'AND (("bucket" IN ($2) AND "actorId" = $3))'
      );
      expect(queryText(1)).toContain(
         'AND (("bucket" IN ($2) AND "actorId" = $3)) AND "bucket" = $4'
      );
      expect(query(1).values.slice(0, 4)).toEqual([
         "server12345",
         "company",
         "user1",
         "company",
      ]);
   });

   it("leaves a bucket filter its one seek instead of a union", async () => {
      const reach = {
         buckets: ["photos", "docs"],
         ownBuckets: [],
         actorId: "user1",
         serverWide: true,
      };
      await listAuditPage({
         serverId: "server12345",
         reach,
         limit: 1,
         bucket: "photos",
      });
      await listAuditPage({
         serverId: "server12345",
         reach,
         limit: 1,
         bucket: "secrets",
      });
      for (const call of [0, 1]) {
         expect(queryText(call)).not.toContain("UNION ALL");
         expect(queryText(call)).toContain(
            `AND ("bucket" IN ($2,$3) OR ${SERVER_ROWS(4)}) AND "bucket" = $5`
         );
      }
   });

   it("keeps owner-only server rows from an admin in both the page and the export", async () => {
      const reach = {
         buckets: [],
         ownBuckets: [],
         actorId: "admin12345",
         serverWide: true,
      };
      await listAuditPage({ serverId: "server12345", reach, limit: 1 });
      await iterateAudit({ serverId: "server12345", reach }).next();
      for (const call of [0, 1]) {
         expect(queryText(call)).toContain(`AND (${SERVER_ROWS(2)})`);
         expect(query(call).values[1]).toEqual(["credentials.update"]);
      }
      await listAuditPage({ serverId: "server12345", reach: null, limit: 1 });
      expect(queryText(2)).not.toContain('"action" <> ALL');
   });
});

describe("text search cost", () => {
   const search = { serverId: "s", reach: null, limit: 1, q: "png" };
   const canceled = () =>
      new Prisma.PrismaClientKnownRequestError("Raw query failed", {
         code: "P2010",
         clientVersion: "test",
         meta: {
            code: "57014",
            message: "canceling statement due to statement timeout",
         },
      });

   it("runs a search under an 8 second statement timeout in its own transaction", async () => {
      await listAuditPage(search);
      expect(h.transaction).toHaveBeenCalledWith({
         timeout: 10_000,
         maxWait: 10_000,
      });
      const [strings] = h.queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(strings.join("")).toBe("SET LOCAL statement_timeout = '8s'");
      expect(h.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
         h.selectRows.mock.invocationCallOrder[0]!
      );
      expect(queryText()).toContain('"target" ILIKE $2');
   });

   it("bounds an unfiltered page the same way", async () => {
      await listAuditPage({ serverId: "s", reach: null, limit: 1 });
      expect(h.transaction).toHaveBeenCalledOnce();
      const [strings] = h.queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(strings.join("")).toBe("SET LOCAL statement_timeout = '8s'");
      expect(h.selectRows).toHaveBeenCalledOnce();
   });

   it("bounds every export batch under its own timeout", async () => {
      h.selectRows
         .mockResolvedValueOnce(
            Array.from({ length: 1000 }, (_, i) =>
               row(
                  `row${String(i).padStart(5, "0")}`,
                  "2026-09-06T12:00:00.000Z"
               )
            )
         )
         .mockResolvedValueOnce([]);
      for await (const entry of iterateAudit({
         serverId: "s",
         reach: null,
      }))
         expect(entry.action).toBe("object.delete");
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(h.queryRaw).toHaveBeenCalledTimes(2);
   });

   it("asks for a narrower search when Postgres cancels it", async () => {
      h.selectRows.mockRejectedValueOnce(canceled());
      await expect(listAuditPage(search)).rejects.toMatchObject({
         status: 422,
         message: expect.stringMatching(/Narrow the search/),
      });
   });

   it("bounds every export batch the same way", async () => {
      h.selectRows.mockRejectedValueOnce(canceled());
      const rows = iterateAudit({ serverId: "s", reach: null, q: "png" });
      await expect(rows.next()).rejects.toMatchObject({ status: 422 });
   });

   const holdReads = () => {
      const held = Promise.withResolvers<void>();
      h.selectRows.mockImplementation(async () => {
         await held.promise;
         return [];
      });
      return held;
   };

   it("turns a fifth concurrent search away at once, and frees its slots afterwards", async () => {
      const held = holdReads();
      const running = Array.from({ length: 4 }, () => listAuditPage(search));
      await expect(listAuditPage(search)).rejects.toMatchObject({
         status: 429,
         code: "RATE_LIMITED",
      });
      expect(h.transaction).toHaveBeenCalledTimes(4);
      held.resolve();
      await Promise.all(running);
      h.selectRows.mockResolvedValue([]);
      await expect(listAuditPage(search)).resolves.toMatchObject({
         entries: [],
      });
   });

   it("frees a slot when the search fails", async () => {
      h.selectRows.mockRejectedValue(canceled());
      for (let i = 0; i < 5; i++)
         await expect(listAuditPage(search)).rejects.toMatchObject({
            status: 422,
         });
   });

   it("queues an export batch for a slot instead of failing it mid-stream", async () => {
      const held = holdReads();
      const running = Array.from({ length: 4 }, () => listAuditPage(search));
      const exported = iterateAudit({ serverId: "s", reach: null }).next();
      await Promise.resolve();
      expect(h.transaction).toHaveBeenCalledTimes(4);
      await expect(listAuditPage(search)).rejects.toMatchObject({
         status: 429,
      });
      held.resolve();
      await Promise.all(running);
      await expect(exported).resolves.toMatchObject({ done: true });
      expect(h.transaction).toHaveBeenCalledTimes(5);
   });

   it("gives up on a queued export batch once the wait outlasts a search", async () => {
      const held = holdReads();
      const running = Array.from({ length: 4 }, () => listAuditPage(search));
      const exported = iterateAudit({ serverId: "s", reach: null }).next();
      const refused = expect(exported).rejects.toMatchObject({ status: 429 });
      await vi.advanceTimersByTimeAsync(10_000);
      await refused;
      held.resolve();
      await Promise.all(running);
      h.selectRows.mockResolvedValue([]);
      await expect(listAuditPage(search)).resolves.toBeDefined();
   });

   it("keeps the last slot for searches however many exports are waiting", async () => {
      const held = holdReads();
      const exports = Array.from({ length: 4 }, () =>
         iterateAudit({ serverId: "s", reach: null }).next()
      );
      await Promise.resolve();
      expect(h.transaction).toHaveBeenCalledTimes(3);
      const searched = listAuditPage(search);
      await Promise.resolve();
      expect(h.transaction).toHaveBeenCalledTimes(4);
      await expect(listAuditPage(search)).rejects.toMatchObject({
         status: 429,
      });
      held.resolve();
      await searched;
      await expect(Promise.all(exports)).resolves.toHaveLength(4);
      expect(h.transaction).toHaveBeenCalledTimes(5);
   });

   it("holds one person to two searches at a time, leaving the rest for others", async () => {
      const held = holdReads();
      const mine = { ...search, viewerId: "viewer1234" };
      const running = [listAuditPage(mine), listAuditPage(mine)];
      await expect(listAuditPage(mine)).rejects.toMatchObject({
         status: 429,
         code: "RATE_LIMITED",
         message: expect.stringMatching(/earlier audit searches/),
      });
      running.push(listAuditPage({ ...search, viewerId: "viewer5678" }));
      await Promise.resolve();
      expect(h.transaction).toHaveBeenCalledTimes(3);
      held.resolve();
      await Promise.all(running);
      h.selectRows.mockResolvedValue([]);
      await expect(listAuditPage(mine)).resolves.toBeDefined();
   });

   it("does not count a person's export against their searches", async () => {
      const held = holdReads();
      const mine = { ...search, viewerId: "viewer1234" };
      const exported = iterateAudit({
         serverId: "s",
         reach: null,
         viewerId: "viewer1234",
      }).next();
      const running = [listAuditPage(mine), listAuditPage(mine)];
      await Promise.resolve();
      expect(h.transaction).toHaveBeenCalledTimes(3);
      held.resolve();
      await Promise.all([exported, ...running]);
   });

   it("passes any other database failure on untouched", async () => {
      const failure = new Prisma.PrismaClientKnownRequestError("Raw failed", {
         code: "P2010",
         clientVersion: "test",
         meta: { code: "40001" },
      });
      h.selectRows.mockRejectedValueOnce(failure);
      await expect(listAuditPage(search)).rejects.toBe(failure);
   });
});

describe("the other end of a transfer", () => {
   const transfer = (actorId: string, detail: Record<string, unknown>) => ({
      ...row("t1", "2026-09-06T12:00:00.000Z"),
      action: "object.transfer",
      actorId,
      detail,
   });
   const foreign = {
      fromServerId: "elsewhere12",
      fromBucket: "private",
      from: "secret.txt",
      other: "kept",
   };
   const owner = { serverId: "server12345", reach: null, limit: 10 };
   const detailOf = async (
      filters: Parameters<typeof listAuditPage>[0],
      actorId = "someone-else"
   ) => {
      h.selectRows.mockResolvedValue([transfer(actorId, foreign)]);
      return (await listAuditPage(filters)).entries[0]?.detail;
   };

   it("hides a server an owner is not a member of", async () => {
      expect(await detailOf({ ...owner, viewerId: "owner12345" })).toEqual({
         other: "kept",
      });
      expect(h.accessFind).toHaveBeenCalledWith({
         where: { userId: "owner12345", serverId: { in: ["elsewhere12"] } },
         select: { serverId: true, role: true },
      });
      expect(h.grantFind).not.toHaveBeenCalled();
   });

   it("shows it to an owner who also owns the other server", async () => {
      h.accessFind.mockResolvedValue([
         { serverId: "elsewhere12", role: "OWNER" },
      ]);
      expect(await detailOf({ ...owner, viewerId: "owner12345" })).toEqual(
         foreign
      );
      expect(h.grantFind).not.toHaveBeenCalled();
   });

   it("needs a whole-bucket grant there when the owner is only a member", async () => {
      h.accessFind.mockResolvedValue([
         { serverId: "elsewhere12", role: "ADMIN" },
      ]);
      expect(await detailOf({ ...owner, viewerId: "owner12345" })).toEqual({
         other: "kept",
      });
      expect(h.grantFind).toHaveBeenCalledWith({
         where: {
            userId: "owner12345",
            serverId: { in: ["elsewhere12"] },
            bucketName: { in: ["private"] },
            restrictedFolders: false,
         },
         select: { serverId: true, bucketName: true },
      });

      h.grantFind.mockResolvedValue([
         { serverId: "elsewhere12", bucketName: "private" },
      ]);
      expect(await detailOf({ ...owner, viewerId: "owner12345" })).toEqual(
         foreign
      );
   });

   it("does not let a grant on one bucket reveal another bucket there", async () => {
      h.accessFind.mockResolvedValue([
         { serverId: "elsewhere12", role: "VIEWER" },
      ]);
      h.grantFind.mockResolvedValue([
         { serverId: "elsewhere12", bucketName: "public" },
      ]);
      expect(await detailOf({ ...owner, viewerId: "owner12345" })).toEqual({
         other: "kept",
      });
   });

   it("hides it when the viewer is unknown, without asking who joined", async () => {
      expect(await detailOf(owner)).toEqual({ other: "kept" });
      expect(h.accessFind).not.toHaveBeenCalled();
   });

   it("keeps a row the viewer wrote, and an end on the same server", async () => {
      expect(
         await detailOf({ ...owner, viewerId: "owner12345" }, "owner12345")
      ).toEqual(foreign);
      h.accessFind.mockClear();
      h.selectRows.mockResolvedValue([
         transfer("someone-else", { ...foreign, fromServerId: "server12345" }),
      ]);
      expect(
         (await listAuditPage({ ...owner, viewerId: "owner12345" })).entries[0]
            ?.detail
      ).toMatchObject({ fromBucket: "private" });
      expect(h.accessFind).not.toHaveBeenCalled();
   });

   it("does not ask about membership for a bucket-limited viewer, who never sees a foreign end", async () => {
      const reach = {
         buckets: ["photos"],
         ownBuckets: [],
         actorId: "member12345",
         serverWide: false,
      };
      expect(
         await detailOf({
            ...owner,
            reach,
            viewerId: "member12345",
         })
      ).toEqual({ other: "kept" });
      expect(h.accessFind).not.toHaveBeenCalled();
   });
});

describe("the grants a member or invite row lists", () => {
   const grantRow = (action: string, buckets: string) => ({
      ...row("g1", "2026-09-06T12:00:00.000Z"),
      action,
      bucket: null,
      detail: { role: "EDITOR", buckets },
   });
   const admin = {
      serverId: "server12345",
      reach: {
         buckets: ["photos"],
         ownBuckets: ["drafts"],
         actorId: "actor12345",
         serverWide: true,
      },
      limit: 10,
   };
   const detailOf = async (
      filters: Parameters<typeof listAuditPage>[0],
      action: string,
      buckets: string
   ) => {
      h.selectRows.mockResolvedValue([grantRow(action, buckets)]);
      return (await listAuditPage(filters)).entries[0]?.detail;
   };

   it.each(["member.role_change", "invite.send", "invite.accept"])(
      "hides %s grants from a reader who holds none of a listed bucket, even on their own row",
      async (action) => {
         expect(
            await detailOf(admin, action, "photos:VIEWER,secret:EDITOR")
         ).toEqual({ role: "EDITOR" });
      }
   );

   it("keeps them when the reader holds every listed bucket, whole or by folder", async () => {
      const buckets = 'drafts:VIEWER["a/","b,c/"],photos:EDITOR';
      expect(await detailOf(admin, "member.role_change", buckets)).toEqual({
         role: "EDITOR",
         buckets,
      });
   });

   it("finds a hidden bucket listed after folders and in a digest", async () => {
      expect(
         await detailOf(
            admin,
            "member.role_change",
            'photos:VIEWER["a/","b/"],secret:VIEWER[3 folders sha256:abc]'
         )
      ).toEqual({ role: "EDITOR" });
   });

   it("shows an owner every grant", async () => {
      const buckets = "photos:VIEWER,secret:EDITOR";
      expect(
         await detailOf(
            { ...admin, reach: null, viewerId: "owner12345" },
            "member.role_change",
            buckets
         )
      ).toEqual({ role: "EDITOR", buckets });
   });

   it("redacts the export the same way", async () => {
      h.selectRows.mockResolvedValueOnce([
         grantRow("invite.send", "secret:VIEWER"),
      ]);
      const entries = [];
      for await (const entry of iterateAudit(admin)) entries.push(entry);
      expect(entries[0]?.detail).toEqual({ role: "EDITOR" });
   });
});

describe("iterateAudit", () => {
   it("walks the log in keyset batches of 1000 without loading it whole", async () => {
      const batch = (from: number, size: number) =>
         Array.from({ length: size }, (_, i) =>
            row(
               `row${String(from + i).padStart(5, "0")}`,
               "2026-09-06T12:00:00.000Z",
               from + i
            )
         );
      h.selectRows
         .mockResolvedValueOnce(batch(2000, 1000))
         .mockResolvedValueOnce(batch(1000, 1000))
         .mockResolvedValueOnce(batch(0, 7));
      let seen = 0;
      for await (const entry of iterateAudit({
         serverId: "server12345",
         reach: null,
      })) {
         expect(entry.action).toBe("object.delete");
         expect(entry.prevHash).toBe("");
         expect(entry.hash).toBe("h");
         seen++;
      }
      expect(seen).toBe(2007);
      expect(h.selectRows).toHaveBeenCalledTimes(3);
      expect(query().values).toEqual(["server12345", 1000]);
      expect(queryText(1)).toContain(
         '("createdAt", "id") < ($2::timestamp, $3)'
      );
      expect(query(1).values).toEqual([
         "server12345",
         "2026-09-06T12:00:00.000Z",
         "row02999",
         1000,
      ]);
   });
});
