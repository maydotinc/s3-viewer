import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AuditLevel, type AuditEntry } from "@s3-viewer/types";
import {
   NOW,
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

const { LOCK_NAMESPACE } = await import("@/lib/db-locks");
const { setAuditChainKey } = await import("./chain");
const {
   AuditWriteError,
   appendAuditWithin,
   auditLoss,
   flushAudits,
   flushAuditsWithin,
   recentlySeen,
   writeAudit,
   writeAudits,
} = await import("./writer");
const { verifyAuditChain } = await import("./query");
const { record, recordAlways, recordMany } = await import(
   "@/lib/middleware/audit-record"
);

const stored = (): Stored[] => storedRows(h);

const written = async (queued: Promise<void>): Promise<void> => {
   await queued;
   await flushAudits();
};

const lockSql = (call = 0): Prisma.Sql => {
   const [strings, ...values] = (h.queryRaw.mock.calls[call] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

const lockText = (call = 0): string =>
   lockSql(call).text.replace(/\s+/g, " ").trim();

const uniqueViolation = () =>
   new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
   });

const transactionTimeout = () =>
   new Prisma.PrismaClientKnownRequestError("Transaction already closed", {
      code: "P2028",
      clientVersion: "test",
   });

const trackHead = () => {
   let head: { seq: number; hash: string } | null = null;
   h.headFind.mockImplementation(async () => head);
   h.headUpsert.mockImplementation(
      async ({ create }: { create: { seq: number; hash: string } }) => {
         head = { seq: create.seq, hash: create.hash };
         return {};
      }
   );
};

const deletions = (count: number): AuditEntry[] =>
   Array.from({ length: count }, (_, i) => ({
      action: "object.delete",
      bucket: "photos",
      target: `${i}.png`,
   }));

const elsewhere = (serverId: string, action: AuditEntry["action"]) =>
   writeAudit({
      serverId,
      actor: { id: "actor12345", email: "actor@example.com" },
      audit: { enabled: true, level: AuditLevel.ALL },
      entry: { action },
   });

// access.denied is queued and never collapsed, unlike a repeated listing.
const queuedEntries = (count: number): AuditEntry[] =>
   Array.from({ length: count }, () => ({ action: "access.denied" }));

const queuedFor = (serverId: string, count: number) =>
   writeAudits({
      serverId,
      actor: { id: "actor12345", email: "actor@example.com" },
      audit: { enabled: true, level: AuditLevel.ALL },
      entries: queuedEntries(count),
   });

useAuditClock(setAuditChainKey);

beforeEach(async () => {
   await flushAudits();
   resetAuditMocks(h);
});

describe("record", () => {
   it("writes nothing while the server's log is off", async () => {
      await written(
         record(fakeRes(false), { action: "object.list", bucket: "photos" })
      );
      expect(h.createMany).not.toHaveBeenCalled();
      expect(h.queryRaw).not.toHaveBeenCalled();
   });

   it("copies the actor and server in, clips long text and starts the chain", async () => {
      const long = "k".repeat(2000);
      await written(
         record(fakeRes(true), {
            action: "object.upload",
            bucket: "photos",
            target: long,
            detail: { size: 12, contentType: long, replaced: false },
         })
      );
      expect(h.transaction).toHaveBeenCalledWith({
         isolationLevel: "ReadCommitted",
         timeout: 30_000,
         maxWait: 10_000,
      });
      expect(lockText()).toBe(
         "SELECT pg_advisory_xact_lock( $1::int4, hashtext($2) )"
      );
      expect(lockSql().values).toEqual([
         LOCK_NAMESPACE.AUDIT_APPEND,
         "server12345",
      ]);
      expect(h.createMany).toHaveBeenCalledWith({
         data: [
            {
               serverId: "server12345",
               seq: 1,
               actorId: "actor12345",
               actorEmail: "actor@example.com",
               action: "object.upload",
               bucket: "photos",
               target: "k".repeat(1024),
               detail: {
                  size: 12,
                  contentType: "k".repeat(1024),
                  replaced: false,
               },
               prevHash: "",
               hash: expect.stringMatching(/^[0-9a-f]{64}$/),
               createdAt: NOW,
            },
         ],
      });
   });

   it("sanitizes database-invalid text before a hostile export can poison a peer", async () => {
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         if (JSON.stringify(data).includes("\\u0000"))
            throw new Error("invalid JSONB text");
         return { count: data.length };
      });
      await record(fakeRes(true), {
         action: "audit.export",
         bucket: "bad\0bucket",
         target: "bad\0target",
         detail: { q: "bad\0query", ["bad\0key"]: "lone\ud800" },
      });
      await written(
         record(fakeRes(true), { action: "object.download", target: "safe" })
      );
      expect(stored()).toHaveLength(2);
      expect(stored()[0]).toMatchObject({
         bucket: "bad�bucket",
         target: "bad�target",
         detail: { q: "bad�query", "bad�key": "lone�" },
      });
      expect(stored()[1]?.target).toBe("safe");
      expect(h.warn).not.toHaveBeenCalled();
   });

   it("does not leave half a surrogate pair at the clip", async () => {
      await written(
         record(fakeRes(true), {
            action: "object.upload",
            bucket: "photos",
            target: "k".repeat(1023) + "😀",
         })
      );
      expect(stored()[0]?.target).toBe("k".repeat(1023) + "�");
   });

   it("hashes exactly the row's content with the chain key, detail keys sorted", async () => {
      await written(
         record(fakeRes(true), {
            action: "object.upload",
            bucket: "photos",
            target: "report.json",
            detail: { size: 12, replaced: false },
         })
      );
      const content = JSON.stringify([
         "server12345",
         1,
         "actor12345",
         "actor@example.com",
         "object.upload",
         "photos",
         "report.json",
         '{"replaced":false,"size":12}',
         "2026-09-07T12:00:00.000Z",
         "",
      ]);
      expect(stored()[0]?.hash).toBe(hmac(content));
      expect(stored()[0]?.hash).not.toBe(
         createHash("sha256").update(content).digest("hex")
      );
   });

   it("continues the chain from the server's recorded head", async () => {
      h.headFind.mockResolvedValue({ seq: 7, hash: "abc" });
      await written(
         record(fakeRes(true), { action: "bucket.create", bucket: "photos" })
      );
      expect(h.findFirst).not.toHaveBeenCalled();
      expect(stored()[0]).toMatchObject({ seq: 8, prevHash: "abc" });
   });

   it("refuses to rebuild a missing head from retained rows without retrying every entry", async () => {
      h.findFirst.mockResolvedValue({ seq: 7, hash: "abc" });
      const before = auditLoss().failed;
      await written(recordMany(fakeRes(true), deletions(20)));
      expect(h.createMany).not.toHaveBeenCalled();
      expect(h.headUpsert).not.toHaveBeenCalled();
      expect(h.transaction).toHaveBeenCalledOnce();
      expect(auditLoss().failed - before).toBe(20);
      expect(h.error).toHaveBeenCalledWith("Could not record audit entry", {
         serverId: "server12345",
         action: "object.delete",
         reason: "write failed",
         error: expect.stringContaining("Audit chain head is missing"),
      });
   });

   it("refuses to rebuild a head that disappeared before reconciliation", async () => {
      h.headFind
         .mockResolvedValueOnce({ seq: 7, hash: "abc" })
         .mockResolvedValue(null);
      h.findFirst.mockResolvedValue({ seq: 7, hash: "abc" });
      h.createMany.mockRejectedValueOnce(uniqueViolation());
      const before = auditLoss().failed;
      await written(record(fakeRes(true), { action: "bucket.create" }));
      expect(h.createMany).toHaveBeenCalledOnce();
      expect(h.headUpsert).not.toHaveBeenCalled();
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(auditLoss().failed - before).toBe(1);
   });

   it("reconciles newer retained rows when the existing head is still present", async () => {
      h.headFind.mockResolvedValue({ seq: 7, hash: "abc" });
      h.findFirst.mockResolvedValue({ seq: 8, hash: "def" });
      h.createMany
         .mockRejectedValueOnce(uniqueViolation())
         .mockResolvedValueOnce({ count: 1 });
      await written(record(fakeRes(true), { action: "bucket.create" }));
      expect(stored().map(({ seq, prevHash }) => ({ seq, prevHash }))).toEqual([
         { seq: 8, prevHash: "abc" },
         { seq: 9, prevHash: "def" },
      ]);
      expect(h.warn).not.toHaveBeenCalled();
   });

   it("retries once when a racing writer took the next seq", async () => {
      h.createMany
         .mockRejectedValueOnce(uniqueViolation())
         .mockResolvedValueOnce({ count: 1 });
      await written(record(fakeRes(true), { action: "bucket.create" }));
      expect(h.createMany).toHaveBeenCalledTimes(2);
      expect(h.warn).not.toHaveBeenCalled();

      h.createMany.mockRejectedValue(uniqueViolation());
      await written(record(fakeRes(true), { action: "bucket.create" }));
      expect(h.createMany).toHaveBeenCalledTimes(4);
      expect(h.error).toHaveBeenCalledWith(
         "Could not record audit entry",
         expect.objectContaining({ action: "bucket.create" })
      );
   });

   it("records settings changes even while the log is off", async () => {
      await written(
         recordAlways(fakeRes(false), {
            action: "audit.settings_change",
            detail: { enabled: false },
         })
      );
      expect(h.createMany).toHaveBeenCalledOnce();
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await expect(
         written(
            recordAlways(fakeRes(false), { action: "audit.settings_change" })
         )
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith(
         "audit write failed after action",
         expect.objectContaining({ actions: ["audit.settings_change"] })
      );
   });

   it("isolates an invalid row and retains its valid peers in chain order", async () => {
      const retained: Stored[] = [];
      const dataError = new Prisma.PrismaClientKnownRequestError(
         "invalid value",
         { code: "P2000", clientVersion: "test" }
      );
      h.headFind.mockImplementation(async () => retained.at(-1) ?? null);
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         if (data.some((row) => row.target === "invalid")) throw dataError;
         retained.push(...data);
         return { count: data.length };
      });
      const before = auditLoss().failed;
      await written(
         recordMany(fakeRes(true), [
            { action: "object.delete", target: "before" },
            { action: "object.delete", target: "invalid" },
            { action: "object.delete", target: "after" },
         ])
      );
      expect(retained.map(({ seq, target }) => ({ seq, target }))).toEqual([
         { seq: 1, target: "before" },
         { seq: 2, target: "after" },
      ]);
      expect(retained[1]?.prevHash).toBe(retained[0]?.hash);
      expect(auditLoss().failed - before).toBe(1);
   });

   it("does not retry a database outage for every row in a batch", async () => {
      h.createMany.mockRejectedValue(new Error("connection reset"));
      const before = auditLoss().failed;
      await written(recordMany(fakeRes(true), deletions(20)));
      expect(h.createMany).toHaveBeenCalledOnce();
      expect(auditLoss().failed - before).toBe(20);
   });

   it("retries a timed-out transaction once before counting its entries lost", async () => {
      h.createMany
         .mockRejectedValueOnce(transactionTimeout())
         .mockResolvedValue({ count: 1 });
      const before = auditLoss().failed;
      await written(record(fakeRes(true), { action: "member.remove" }));
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(h.createMany).toHaveBeenCalledTimes(2);
      expect(h.headUpsert).toHaveBeenCalledOnce();
      expect(h.error).not.toHaveBeenCalled();
      expect(auditLoss().failed).toBe(before);

      h.createMany.mockRejectedValue(transactionTimeout());
      await written(recordMany(fakeRes(true), deletions(6000)));
      expect(h.createMany).toHaveBeenCalledTimes(4);
      expect(h.error).toHaveBeenCalledWith(
         "Could not record audit entry",
         expect.objectContaining({ action: "object.delete" })
      );
      expect(auditLoss().failed - before).toBe(6000);
   });

   it("bounds attempts when every row has a data error", async () => {
      h.createMany.mockRejectedValue(
         new Prisma.PrismaClientKnownRequestError("invalid value", {
            code: "P2000",
            clientVersion: "test",
         })
      );
      const before = auditLoss().failed;
      await written(recordMany(fakeRes(true), deletions(100)));
      expect(h.createMany).toHaveBeenCalledTimes(64);
      expect(auditLoss().failed - before).toBe(100);
   });

   it("never throws after an action: a failed insert is logged as an error", async () => {
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await expect(
         written(
            record(fakeRes(true), { action: "bucket.create", bucket: "photos" })
         )
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith("Could not record audit entry", {
         serverId: "server12345",
         action: "bucket.create",
         reason: "write failed",
         error: expect.stringContaining("connection reset"),
      });
      expect(h.error).toHaveBeenCalledWith("audit write failed after action", {
         serverId: "server12345",
         actions: ["bucket.create"],
         error: expect.stringContaining("could not be recorded"),
      });
      expect(h.warn).not.toHaveBeenCalled();
   });

   it.each(["object.download", "object.archive", "audit.export"] as const)(
      "refuses with 503 when %s cannot be recorded, so nothing is issued",
      async (action) => {
         h.createMany.mockRejectedValue(new Error("connection reset"));
         await expect(
            record(fakeRes(true), { action, bucket: "photos" })
         ).rejects.toMatchObject({ status: 503 });
      }
   );

   it("does not refuse a download while the server's log is off", async () => {
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await expect(
         record(fakeRes(false), { action: "object.download" })
      ).resolves.toBeUndefined();
   });

   it("rejects a direct durable write that failed, and resolves a queued one", async () => {
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await expect(
         elsewhere("direct", "object.download")
      ).rejects.toBeInstanceOf(AuditWriteError);
      await expect(elsewhere("direct", "access.denied")).resolves.toBe(
         undefined
      );
      await flushAudits();
   });

   it("rejects only the callers whose own entries were lost", async () => {
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         if (data.some((row) => row.target === "bad"))
            throw new Prisma.PrismaClientKnownRequestError("invalid value", {
               code: "P2000",
               clientVersion: "test",
            });
         return { count: data.length };
      });
      const write = (target: string) =>
         writeAudit({
            serverId: "pair",
            actor: { id: "actor12345", email: "actor@example.com" },
            audit: { enabled: true, level: AuditLevel.ALL },
            entry: { action: "object.delete", target },
         });
      const results = await Promise.allSettled([write("good"), write("bad")]);
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
   });

   it("writes an audit row inside the caller's transaction", async () => {
      const tx = {
         auditLog: { createMany: h.createMany, findFirst: h.findFirst },
         auditChainHead: { findUnique: h.headFind, upsert: h.headUpsert },
         $executeRaw: h.queryRaw,
      };
      await appendAuditWithin(
         tx as never,
         {
            serverId: "server12345",
            actor: { id: "actor12345", email: "actor@example.com" },
         },
         [{ action: "server.delete", detail: { name: "Old" } }]
      );
      expect(h.transaction).not.toHaveBeenCalled();
      expect(lockText()).toBe(
         "SELECT pg_advisory_xact_lock( $1::int4, hashtext($2) )"
      );
      expect(stored()[0]).toMatchObject({
         serverId: "server12345",
         seq: 1,
         action: "server.delete",
         detail: { name: "Old" },
      });
      expect(h.headUpsert).toHaveBeenCalledOnce();
   });

   it("chunks bulk writes into inserts of at most 1000 rows without breaking the chain", async () => {
      const entries = Array.from({ length: 2500 }, (_, i) => ({
         action: "object.delete" as const,
         bucket: "photos",
         target: `${i}.png`,
      }));
      await written(recordMany(fakeRes(true), entries));
      expect(h.createMany).toHaveBeenCalledTimes(3);
      expect(h.createMany.mock.calls.map((c) => c[0].data.length)).toEqual([
         1000, 1000, 500,
      ]);
      const rows = stored();
      expect(rows.map((r) => r.seq)).toEqual(
         Array.from({ length: 2500 }, (_, i) => i + 1)
      );
      expect(rows[1000]?.prevHash).toBe(rows[999]?.hash);
      expect(rows[2000]?.prevHash).toBe(rows[1999]?.hash);
      serveChain(h, rows);
      h.headFind.mockResolvedValue({ seq: 2500, hash: rows.at(-1)?.hash });
      expect(await verifyAuditChain("server12345")).toEqual({
         ...whole,
         anchorSeq: 2500,
         ok: true,
         rows: 2500,
         firstSeq: 1,
         lastSeq: 2500,
         brokenAt: null,
      });
      expect(h.findMany).toHaveBeenCalledTimes(3);
   });

   it("skips browsing and previews at CHANGES, keeping downloads and refusals", async () => {
      const entries: AuditEntry[] = [
         { action: "object.list", bucket: "photos" },
         { action: "object.view", bucket: "photos", target: "a.png" },
         { action: "object.download", bucket: "photos", target: "a.png" },
         { action: "access.denied", bucket: "photos" },
      ];
      await written(recordMany(fakeRes(true, AuditLevel.CHANGES), entries));
      expect(stored().map((r) => r.action)).toEqual([
         "object.download",
         "access.denied",
      ]);
      await written(
         record(fakeRes(true, AuditLevel.CHANGES), { action: "object.list" })
      );
      expect(h.queryRaw).toHaveBeenCalledTimes(1);
      await written(recordMany(fakeRes(true, AuditLevel.ALL), entries));
      expect(stored()).toHaveLength(6);
   });

   it("writes for a request without server auth given an explicit scope", async () => {
      await written(
         writeAudit({
            serverId: "server999",
            actor: { id: "invitee", email: "invitee@example.com" },
            audit: { enabled: true, level: AuditLevel.CHANGES },
            entry: { action: "invite.accept", detail: { role: "EDITOR" } },
         })
      );
      expect(stored()[0]).toMatchObject({
         serverId: "server999",
         actorEmail: "invitee@example.com",
         action: "invite.accept",
      });
   });
});

describe("repeated reads", () => {
   const listing = (target: string): AuditEntry => ({
      action: "object.list",
      bucket: "photos",
      target,
   });

   it("writes one row for a hundred identical listings within a minute", async () => {
      for (let i = 0; i < 100; i++)
         await record(fakeRes(true), listing("dedupe/hundred/"));
      await flushAudits();
      expect(stored()).toHaveLength(1);
      expect(stored()[0]).toMatchObject({
         action: "object.list",
         target: "dedupe/hundred/",
      });
   });

   it("writes again once the minute has passed", async () => {
      await written(record(fakeRes(true), listing("dedupe/minute/")));
      vi.setSystemTime(NOW.getTime() + 60_000);
      await written(record(fakeRes(true), listing("dedupe/minute/")));
      expect(stored()).toHaveLength(1);
      vi.setSystemTime(NOW.getTime() + 60_001);
      await written(record(fakeRes(true), listing("dedupe/minute/")));
      expect(stored()).toHaveLength(2);
      vi.setSystemTime(NOW);
   });

   it("keys a read by actor, server, bucket, target and detail", async () => {
      const entry = listing("dedupe/keyed/");
      await written(record(fakeRes(true), entry));
      await written(record(fakeRes(true), { ...entry, bucket: "other" }));
      await written(record(fakeRes(true), { ...entry, target: "dedupe/x/" }));
      await written(
         record(fakeRes(true), { ...entry, detail: { recursive: true } })
      );
      await written(
         writeAudit({
            serverId: "server12345",
            actor: { id: "another12345", email: "another@example.com" },
            audit: { enabled: true, level: AuditLevel.ALL },
            entry,
         })
      );
      await written(
         writeAudit({
            serverId: "server67890",
            actor: { id: "actor12345", email: "actor@example.com" },
            audit: { enabled: true, level: AuditLevel.ALL },
            entry,
         })
      );
      await written(record(fakeRes(true), entry));
      expect(stored()).toHaveLength(6);
   });

   it("collapses previews too, but never downloads or changes", async () => {
      const view: AuditEntry = {
         action: "object.view",
         bucket: "photos",
         target: "dedupe/a.png",
      };
      const download: AuditEntry = { ...view, action: "object.download" };
      const [deletion] = deletions(1);
      for (let i = 0; i < 3; i++)
         await written(recordMany(fakeRes(true), [view, download, deletion!]));
      expect(stored().map((row) => row.action)).toEqual([
         "object.view",
         "object.download",
         "object.delete",
         "object.download",
         "object.delete",
         "object.download",
         "object.delete",
      ]);
   });

   it("does not spend the window while the log is off", async () => {
      await written(record(fakeRes(false), listing("dedupe/off/")));
      await written(record(fakeRes(true), listing("dedupe/off/")));
      expect(stored()).toHaveLength(1);
   });
});

describe("the write queue", () => {
   it("lets the request go on without waiting for a read's append", async () => {
      await record(fakeRes(true), {
         action: "access.denied",
         bucket: "photos",
      });
      expect(h.transaction).not.toHaveBeenCalled();
      expect(h.createMany).not.toHaveBeenCalled();
      await flushAudits();
      expect(h.createMany).toHaveBeenCalledOnce();
   });

   it("appends everything queued for a server in one transaction, whoever asked for it", async () => {
      await record(fakeRes(true), { action: "access.denied", bucket: "a" });
      await record(fakeRes(true), { action: "access.denied", bucket: "b" });
      await writeAudit({
         serverId: "server999",
         actor: { id: "other", email: "other@example.com" },
         audit: { enabled: true, level: AuditLevel.ALL },
         entry: { action: "access.denied" },
      });
      await flushAudits();
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(h.createMany).toHaveBeenCalledTimes(2);
      const rows = stored();
      expect(rows.map((r) => [r.serverId, r.seq, r.actorEmail])).toEqual([
         ["server12345", 1, "actor@example.com"],
         ["server12345", 2, "actor@example.com"],
         ["server999", 1, "other@example.com"],
      ]);
      expect(rows[1]?.prevHash).toBe(rows[0]?.hash);
   });

   it("appends a backlog over 5000 entries in separate transactions on one unbroken chain", async () => {
      trackHead();
      await written(recordMany(fakeRes(true), deletions(12_000)));
      expect(h.transaction).toHaveBeenCalledTimes(3);
      expect(h.headUpsert).toHaveBeenCalledTimes(3);
      expect(h.createMany).toHaveBeenCalledTimes(12);
      const rows = stored();
      expect(rows.map((r) => r.seq)).toEqual(
         Array.from({ length: 12_000 }, (_, i) => i + 1)
      );
      expect(rows.map((r) => r.target)).toEqual(
         Array.from({ length: 12_000 }, (_, i) => `${i}.png`)
      );
      expect(rows[5000]?.prevHash).toBe(rows[4999]?.hash);
      expect(rows[10_000]?.prevHash).toBe(rows[9999]?.hash);
      expect(h.warn).not.toHaveBeenCalled();
   });

   it("keeps the slices already committed when a later one fails, without retrying the rest", async () => {
      trackHead();
      for (let i = 0; i < 5; i++)
         h.createMany.mockResolvedValueOnce({ count: 1000 });
      h.createMany.mockRejectedValue(new Error("connection reset"));
      const before = auditLoss().failed;
      await written(recordMany(fakeRes(true), deletions(12_000)));
      expect(h.headUpsert).toHaveBeenCalledOnce();
      expect(h.headUpsert.mock.calls[0]?.[0].create.seq).toBe(5000);
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(h.createMany).toHaveBeenCalledTimes(6);
      expect(auditLoss().failed - before).toBe(7000);
   });

   it("flushes on its own once enough entries are queued", async () => {
      await recordMany(
         fakeRes(true),
         Array.from({ length: 500 }, () => ({
            action: "access.denied" as const,
         }))
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(h.createMany).toHaveBeenCalledOnce();
   });

   it("flushes what a quiet server queued a moment later", async () => {
      await record(fakeRes(true), { action: "access.denied" });
      expect(h.createMany).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(250);
      expect(h.createMany).toHaveBeenCalledOnce();
   });

   it("appends different servers at once, one transaction each", async () => {
      for (const serverId of ["s1", "s2", "s3", "s4", "s5"]) {
         await writeAudit({
            serverId,
            actor: { id: "actor12345", email: "actor@example.com" },
            audit: { enabled: true, level: AuditLevel.ALL },
            entry: { action: "access.denied" },
         });
      }
      let open = 0;
      let peak = 0;
      h.createMany.mockImplementation(async () => {
         peak = Math.max(peak, ++open);
         await Promise.resolve();
         open--;
         return { count: 1 };
      });
      await flushAudits();
      expect(h.transaction).toHaveBeenCalledTimes(5);
      expect(peak).toBe(4);
   });

   it("shares four append slots across durable writes and overlapping background flushes", async () => {
      const gate = Promise.withResolvers<void>();
      let open = 0;
      let peak = 0;
      h.createMany.mockImplementation(async () => {
         peak = Math.max(peak, ++open);
         await gate.promise;
         open--;
         return { count: 1 };
      });
      const mutations = Array.from({ length: 4 }, (_, i) =>
         elsewhere(`durable-${i}`, "member.remove")
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(open).toBe(4);

      await elsewhere("timer", "access.denied");
      await vi.advanceTimersByTimeAsync(250);
      const firstFlush = flushAudits();
      await recordMany(
         fakeRes(true),
         Array.from({ length: 500 }, () => ({ action: "access.denied" }))
      );
      mutations.push(elsewhere("later-durable", "member.remove"));
      const secondFlush = flushAudits();
      expect(secondFlush).toBe(firstFlush);
      await vi.advanceTimersByTimeAsync(500);
      expect(open).toBe(4);
      expect(h.transaction).toHaveBeenCalledTimes(4);

      gate.resolve();
      await Promise.all([...mutations, firstFlush, secondFlush]);
      expect(peak).toBe(4);
      expect(h.transaction).toHaveBeenCalledTimes(7);
      expect(stored()).toHaveLength(506);
      expect(auditLoss().flushing).toBe(0);
   });

   it("releases append slots after failures and drains new arrivals before shutdown flush resolves", async () => {
      const gate = Promise.withResolvers<void>();
      const failedServers = new Set([
         "failed-1",
         "failed-2",
         "failed-3",
         "failed-4",
      ]);
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         if (failedServers.has(data[0]!.serverId)) {
            await gate.promise;
            throw new Error("database unavailable");
         }
         return { count: data.length };
      });
      for (const serverId of failedServers)
         await elsewhere(serverId, "access.denied");
      const before = auditLoss().failed;
      let completed = false;
      const flushing = flushAudits();
      void flushing.then(() => {
         completed = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      await elsewhere("later", "access.denied");
      await elsewhere("failed-1", "access.denied");
      expect(flushAudits()).toBe(flushing);
      expect(completed).toBe(false);

      gate.resolve();
      await flushing;
      expect(completed).toBe(true);
      expect(auditLoss().failed - before).toBe(5);
      expect(stored().map((row) => row.serverId)).toContain("later");
      expect(auditLoss().flushing).toBe(0);
      await elsewhere("recovered", "member.remove");
      expect(stored().at(-1)?.serverId).toBe("recovered");
   });

   it("puts a busy server's next batch behind servers already waiting", async () => {
      const gates = Array.from({ length: 4 }, () =>
         Promise.withResolvers<void>()
      );
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         const row = data[0]!;
         const index = Number(row.serverId.slice("busy-".length));
         if (row.action === "member.remove" && row.serverId.startsWith("busy-"))
            await gates[index]!.promise;
         return { count: data.length };
      });
      const pending = gates.map((_, i) =>
         elsewhere(`busy-${i}`, "member.remove")
      );
      await vi.advanceTimersByTimeAsync(0);
      pending.push(elsewhere("waiting", "member.remove"));
      pending.push(elsewhere("busy-0", "member.role_change"));
      gates[0]!.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(
         stored()
            .slice(4)
            .map((row) => row.serverId)
      ).toEqual(["waiting", "busy-0"]);
      for (const gate of gates) gate.resolve();
      await Promise.all(pending);
   });

   it("does not hold one server's write behind another server's append", async () => {
      const slow = Promise.withResolvers<void>();
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         if (data[0]?.serverId === "slow") await slow.promise;
         return { count: 1 };
      });
      await elsewhere("slow", "access.denied");
      const hung = flushAudits();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.createMany).toHaveBeenCalledOnce();
      expect(auditLoss().flushing).toBe(1);

      await elsewhere("fast", "member.remove");
      expect(stored().map((r) => r.serverId)).toEqual(["slow", "fast"]);

      slow.resolve();
      await hung;
      expect(auditLoss().flushing).toBe(0);
   });

   it("keeps a server's own appends one at a time", async () => {
      const gate = Promise.withResolvers<void>();
      let open = 0;
      let peak = 0;
      let first = true;
      h.createMany.mockImplementation(async () => {
         peak = Math.max(peak, ++open);
         if (first) {
            first = false;
            await gate.promise;
         }
         open--;
         return { count: 1 };
      });
      const started = elsewhere("s1", "member.remove");
      await vi.advanceTimersByTimeAsync(0);
      const next = elsewhere("s1", "member.role_change");
      gate.resolve();
      await Promise.all([started, next]);
      expect(peak).toBe(1);
      expect(h.transaction).toHaveBeenCalledTimes(2);
      expect(stored().map((r) => r.action)).toEqual([
         "member.remove",
         "member.role_change",
      ]);
   });

   it("drains every server on a flush, then forgets their chains", async () => {
      for (const serverId of ["f1", "f2", "f3"]) {
         await elsewhere(serverId, "access.denied");
      }
      expect(h.transaction).not.toHaveBeenCalled();
      await flushAudits();
      expect(stored().map((r) => r.serverId)).toEqual(["f1", "f2", "f3"]);
      expect(auditLoss().flushing).toBe(0);
   });

   it("stops waiting for a forced shutdown's flush at its deadline", async () => {
      const gate = Promise.withResolvers<void>();
      h.createMany.mockImplementation(async () => {
         await gate.promise;
         return { count: 1 };
      });
      await elsewhere("hung", "access.denied");
      let settled = false;
      void flushAuditsWithin(3000).then(() => {
         settled = true;
      });
      await vi.advanceTimersByTimeAsync(2999);
      expect(h.createMany).toHaveBeenCalledOnce();
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      gate.resolve();
      await flushAudits();
   });

   it("ends a forced shutdown's wait as soon as the flush is done", async () => {
      await elsewhere("quick", "access.denied");
      await flushAuditsWithin(3000);
      expect(stored().at(-1)?.serverId).toBe("quick");
      expect(vi.getTimerCount()).toBe(0);
   });

   it("keeps flushing after a drain that threw", async () => {
      h.createMany.mockRejectedValueOnce(new Error("connection reset"));
      h.warn.mockImplementationOnce(() => {
         throw new Error("nothing is safe");
      });
      await record(fakeRes(true), { action: "access.denied" });
      await expect(flushAudits()).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith("Audit flush failed", {
         error: expect.stringContaining("nothing is safe"),
      });
      await record(fakeRes(true), { action: "access.denied" });
      await flushAudits();
      expect(h.createMany).toHaveBeenCalledTimes(2);
   });
});

describe("durability", () => {
   it.each([false, true])(
      "settles a mutation before later reads drain, including append failure=%s",
      async (fails) => {
         const first = Promise.withResolvers<void>();
         const later = Promise.withResolvers<void>();
         h.createMany
            .mockImplementationOnce(async () => {
               await first.promise;
               if (fails) throw new Error("database unavailable");
               return { count: 1 };
            })
            .mockImplementationOnce(async () => {
               await later.promise;
               return { count: 1 };
            });
         let mutationDone = false;
         let flushDone = false;
         const mutation = record(fakeRes(true), {
            action: "member.remove",
         }).then(() => {
            mutationDone = true;
         });
         await vi.advanceTimersByTimeAsync(0);
         await record(fakeRes(true), { action: "access.denied" });
         const flushing = flushAudits().then(() => {
            flushDone = true;
         });
         first.resolve();
         await vi.advanceTimersByTimeAsync(0);
         try {
            expect(h.createMany).toHaveBeenCalledTimes(2);
            expect(mutationDone).toBe(true);
            expect(flushDone).toBe(false);
         } finally {
            later.resolve();
            await Promise.all([mutation, flushing]);
         }
      }
   );

   it("keeps a later mutation waiting for its own batch", async () => {
      const first = Promise.withResolvers<void>();
      const later = Promise.withResolvers<void>();
      h.createMany
         .mockImplementationOnce(() => first.promise)
         .mockImplementationOnce(() => later.promise);
      let laterDone = false;
      const mutation = record(fakeRes(true), { action: "member.remove" });
      await vi.advanceTimersByTimeAsync(0);
      const next = record(fakeRes(true), { action: "member.role_change" }).then(
         () => {
            laterDone = true;
         }
      );
      first.resolve();
      await vi.advanceTimersByTimeAsync(0);
      try {
         expect(laterDone).toBe(false);
         await mutation;
      } finally {
         later.resolve();
         await next;
      }
   });

   it("waits for a mutation's row, not for a read's", async () => {
      await record(fakeRes(true), {
         action: "access.denied",
         bucket: "photos",
      });
      expect(h.createMany).not.toHaveBeenCalled();

      await record(fakeRes(true), {
         action: "member.remove",
         target: "member1234",
      });
      expect(h.createMany).toHaveBeenCalledOnce();
      expect(stored().map((r) => r.action)).toEqual([
         "access.denied",
         "member.remove",
      ]);
   });

   it("still resolves a completed mutation when its durable write fails, and says so", async () => {
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await expect(
         record(fakeRes(true), { action: "member.role_change" })
      ).resolves.toBeUndefined();
      expect(h.error).toHaveBeenCalledWith(
         "audit write failed after action",
         expect.objectContaining({ actions: ["member.role_change"] })
      );
   });
});

describe("lost entries", () => {
   it("counts in-flight rows against capacity and refuses a batch that crosses the limit", async () => {
      const gate = Promise.withResolvers<void>();
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         await gate.promise;
         return { count: data.length };
      });
      const before = auditLoss().dropped;
      const durableFor = (serverId: string, targets: string[]) =>
         writeAudits({
            serverId,
            actor: { id: "actor12345", email: "actor@example.com" },
            audit: { enabled: true, level: AuditLevel.ALL },
            entries: targets.map((target) => ({
               action: "member.remove",
               target,
            })),
         });
      // queued reads may fill four fifths of the buffer, never the headroom kept for durable writes.
      for (const serverId of ["a", "b", "c", "d"])
         await queuedFor(serverId, 10_000);
      await queuedFor("e", 1);
      expect(auditLoss().dropped - before).toBe(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(h.createMany).toHaveBeenCalled();
      const admitted = Promise.all([
         durableFor("f", ["kept-a", "kept-b"]),
         durableFor(
            "g",
            Array.from({ length: 9998 }, (_, i) => `filler-${i}`)
         ),
      ]);
      const refused = Promise.allSettled([
         durableFor("h", ["dropped-a", "dropped-b"]),
      ]);
      await expect(refused).resolves.toMatchObject([{ status: "rejected" }]);
      expect(auditLoss().dropped - before).toBe(3);
      gate.resolve();
      await admitted;
      await flushAudits();
      expect(stored()).toHaveLength(50_000);
      expect(stored().some((row) => row.target === "kept-a")).toBe(true);
      expect(stored().some((row) => row.target === "dropped-a")).toBe(false);

      await elsewhere("capacity-released", "member.remove");
      expect(stored().at(-1)?.serverId).toBe("capacity-released");
      expect(auditLoss().dropped - before).toBe(3);
   });

   it("keeps one server from holding more than a fifth of the buffer", async () => {
      const gate = Promise.withResolvers<void>();
      h.createMany.mockImplementation(async ({ data }: { data: Stored[] }) => {
         await gate.promise;
         return { count: data.length };
      });
      const before = auditLoss().dropped;
      await queuedFor("noisy", 10_000);
      await queuedFor("noisy", 1);
      expect(auditLoss().dropped - before).toBe(1);

      await queuedFor("quiet", 500);
      expect(auditLoss().dropped - before).toBe(1);
      const durable = elsewhere("noisy", "member.remove");
      gate.resolve();
      await durable;
      await flushAudits();
      expect(stored().filter((r) => r.serverId === "noisy")).toHaveLength(
         10_001
      );
      expect(stored().filter((r) => r.serverId === "quiet")).toHaveLength(500);

      await queuedFor("noisy", 1);
      await flushAudits();
      expect(auditLoss().dropped - before).toBe(1);
   });

   it("counts and reports what the full queue drops, at most a line a minute", () => {
      vi.setSystemTime(NOW.getTime() + 60 * 60_000);
      const before = auditLoss();
      for (const serverId of ["a", "b", "c", "d"])
         void queuedFor(serverId, 10_000);
      void queuedFor("e", 1);
      void queuedFor("f", 1);
      expect(auditLoss().dropped).toBe(before.dropped + 2);
      expect(h.error).toHaveBeenCalledOnce();
      expect(h.error).toHaveBeenCalledWith(
         "Audit entries were not recorded",
         expect.objectContaining({
            reason: "queued share",
            count: 1,
            droppedEntries: before.dropped + 1,
         })
      );
      vi.setSystemTime(NOW);
   });

   it("counts entries a failed write lost", async () => {
      const before = auditLoss();
      h.createMany.mockRejectedValue(new Error("connection reset"));
      await written(recordMany(fakeRes(true), deletions(2)));
      expect(auditLoss().failed).toBe(before.failed + 2);
   });
});

describe("recentlySeen", () => {
   it("answers true for a repeat within five minutes, then forgets it", () => {
      const at = NOW.getTime();
      vi.setSystemTime(at);
      expect(recentlySeen("k")).toBe(false);
      expect(recentlySeen("k")).toBe(true);
      expect(recentlySeen("other")).toBe(false);
      vi.setSystemTime(at + 5 * 60_000 + 1);
      expect(recentlySeen("k")).toBe(false);
      vi.setSystemTime(at);
   });

   it("keeps a bounded number of keys, evicting the least recent first", () => {
      const at = NOW.getTime();
      vi.setSystemTime(at);
      expect(recentlySeen("first")).toBe(false);
      expect(recentlySeen("first")).toBe(true);
      for (let i = 0; i < 20_000; i++) recentlySeen(`minted:${i}`);
      expect(recentlySeen("first")).toBe(false);
      expect(recentlySeen("minted:19999")).toBe(true);
   });

   it("forgets an expired key without scanning the map for it", () => {
      const at = NOW.getTime();
      vi.setSystemTime(at);
      expect(recentlySeen("stale")).toBe(false);
      vi.setSystemTime(at + 5 * 60_000 + 1);
      expect(recentlySeen("stale")).toBe(false);
      expect(recentlySeen("stale")).toBe(true);
      vi.setSystemTime(at);
   });
});
