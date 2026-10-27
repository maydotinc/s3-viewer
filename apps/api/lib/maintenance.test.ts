import { Prisma } from "@prisma/client";
import { DAY_MS, SESSION_ABSOLUTE_TTL_DAYS } from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   executeRaw: vi.fn(),
   queryRaw: vi.fn(),
   pruneBatch: vi.fn(),
   lockRaw: vi.fn(),
   transaction: vi.fn(),
   expiredServers: vi.fn(),
   sweepRateLimits: vi.fn(),
   writeAudit: vi.fn(),
   error: vi.fn(),
   warn: vi.fn(),
   info: vi.fn(),
   debug: vi.fn(),
   retentionDays: 30,
   minRetentionDays: 1,
   unverifiedTtlDays: 7,
}));

vi.mock("./env", () => ({
   env: {
      get AUDIT_RETENTION_DAYS() {
         return h.retentionDays;
      },
      get AUDIT_RETENTION_MIN_DAYS() {
         return h.minRetentionDays;
      },
      get UNVERIFIED_ACCOUNT_TTL_DAYS() {
         return h.unverifiedTtlDays;
      },
   },
}));
vi.mock("./logger", () => ({
   logger: { info: h.info, warn: h.warn, debug: h.debug, error: h.error },
}));
vi.mock("./audit/writer", () => ({ writeAudit: h.writeAudit }));
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $executeRaw: h.executeRaw,
      $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
         const head = String(strings[0]);
         if (head.includes("WITH deleted"))
            return h.pruneBatch(strings, ...values);
         if (head.includes("LATERAL"))
            return h.expiredServers(strings, ...values);
         return h.queryRaw(strings, ...values);
      },
      $transaction: (
         work: (tx: unknown) => Promise<unknown>,
         options: unknown
      ) => {
         h.transaction(options);
         return work({ $queryRaw: h.lockRaw });
      },
   },
}));
// fake timers do not reach node:timers/promises, so the pause between delete batches resolves at once.
vi.mock("node:timers/promises", () => ({ setTimeout: async () => {} }));
vi.mock("@s3-viewer/db/rate-limit", () => ({
   sweepRateLimits: h.sweepRateLimits,
}));

const { LOCK_NAMESPACE } = await import("./db-locks");
const { BOOT_DELAY_MS, BOOT_JITTER_MS, startMaintenance } = await import(
   "./maintenance"
);

const NOW = new Date("2026-09-07T12:00:00.000Z");
const cutoff = (days: number) =>
   new Date(NOW.getTime() - days * DAY_MS).toISOString();
const SERVER7 = { id: "server7", seq: 900 };

const sqlOf = (call: unknown[]): Prisma.Sql => {
   const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
   return Prisma.sql(strings, ...values);
};

const textOf = (call: unknown[]): string =>
   sqlOf(call).text.replace(/\s+/g, " ").trim();

const sweepOnce = async () => {
   const random = vi.spyOn(Math, "random").mockReturnValue(0);
   vi.useFakeTimers({ now: NOW.getTime() - BOOT_DELAY_MS });
   startMaintenance();
   await vi.advanceTimersByTimeAsync(BOOT_DELAY_MS + 1000);
   vi.useRealTimers();
   random.mockRestore();
};

const callsMatching = (mock: typeof h.executeRaw, needle: string) =>
   mock.mock.calls.filter((call) => textOf(call).includes(needle));

const deleting = (counts: Record<string, number[]>) => {
   h.pruneBatch.mockImplementation(() =>
      Promise.resolve([{ count: counts.audit_log?.shift() ?? 0 }])
   );
   h.executeRaw.mockImplementation((...call: unknown[]) => {
      const table = /(?:DELETE FROM|UPDATE) "(\w+)"/.exec(textOf(call))?.[1];
      return Promise.resolve((table && counts[table]?.shift()) || 0);
   });
};

const pruned = () =>
   callsMatching(h.pruneBatch, 'AND "seq" <=').map((call) => {
      const [serverId, seq] = sqlOf(call).values;
      return { serverId, seq };
   });

const deletesFrom = (table: string) =>
   callsMatching(h.executeRaw, `DELETE FROM "${table}"`);

const sweepLog = () => h.info.mock.calls[0]?.[1];

beforeEach(() => {
   vi.clearAllMocks();
   h.retentionDays = 30;
   h.minRetentionDays = 1;
   h.unverifiedTtlDays = 7;
   h.writeAudit.mockReset().mockResolvedValue(undefined);
   h.sweepRateLimits.mockResolvedValue(0);
   h.executeRaw.mockResolvedValue(0);
   h.pruneBatch.mockReset().mockResolvedValue([{ count: 0 }]);
   h.queryRaw.mockResolvedValue([]);
   h.lockRaw.mockResolvedValue([{ locked: true }]);
   h.expiredServers.mockResolvedValue([]);
});

describe("audit log prune", () => {
   it("prunes each server through its newest expired row, in full batches until one comes up short", async () => {
      h.expiredServers.mockResolvedValue([
         SERVER7,
         { id: "server90", seq: 800 },
         { id: "serverDefault", seq: 700 },
      ]);
      deleting({ audit_log: [5000, 5000, 120, 3, 40] });
      await sweepOnce();

      expect(pruned()).toEqual([
         { serverId: "server7", seq: 900 },
         { serverId: "server7", seq: 900 },
         { serverId: "server7", seq: 900 },
         { serverId: "server90", seq: 800 },
         { serverId: "serverDefault", seq: 700 },
      ]);
      expect(sweepLog()).toMatchObject({ auditRows: 10_163, rateLimitRows: 0 });
   });

   it("finds every server's newest expired row in one query, not one per server", async () => {
      h.expiredServers.mockResolvedValue([SERVER7, { id: "server8", seq: 4 }]);
      deleting({ audit_log: [5000, 1, 2] });
      await sweepOnce();

      expect(h.expiredServers).toHaveBeenCalledOnce();
      expect(h.queryRaw).toHaveBeenCalledOnce();
      expect(textOf(h.queryRaw.mock.calls[0] ?? [])).toContain("RECURSIVE");
      expect(pruned()).toHaveLength(3);
   });

   it("deletes nothing when no server has a row past its cutoff", async () => {
      await sweepOnce();

      expect(h.pruneBatch).not.toHaveBeenCalled();
      expect(sweepLog()).toMatchObject({ auditRows: 0, rateLimitRows: 0 });
   });

   it("pages the servers instead of loading every row of them", async () => {
      const page = (from: number, size: number) =>
         Array.from({ length: size }, (_, i) => ({
            id: `server${String(from + i).padStart(4, "0")}`,
            seq: 1,
         }));
      h.expiredServers
         .mockResolvedValueOnce(page(0, 500))
         .mockResolvedValueOnce(page(500, 3));
      await sweepOnce();

      expect(h.expiredServers).toHaveBeenCalledTimes(2);
      const [first, second] = h.expiredServers.mock.calls.map(
         (call) => sqlOf(call).values
      );
      expect(first?.at(3)).toBe("");
      expect(second?.at(3)).toBe("server0499");
      expect(first?.at(-1)).toBe(500);
   });

   it("logs a failing phase instead of throwing, and still runs the phases after it", async () => {
      h.expiredServers.mockRejectedValue(new Error("database is starting up"));
      deleting({ session: [4] });
      h.sweepRateLimits.mockResolvedValue(7);
      await expect(sweepOnce()).resolves.toBeUndefined();

      expect(h.warn).toHaveBeenCalledOnce();
      expect(h.warn).toHaveBeenCalledWith("Maintenance sweep failed", {
         phase: "auditRows",
         error: expect.stringContaining("database is starting up"),
      });
      expect(h.lockRaw).toHaveBeenCalledTimes(9);
      expect(h.info).toHaveBeenCalledOnce();
      expect(h.info).toHaveBeenCalledWith("Maintenance sweep", {
         orphanedAuditRows: 0,
         orphanedChainHeads: 0,
         sessionRows: 4,
         verificationRows: 0,
         archiveTicketRows: 0,
         pendingInvitationRows: 0,
         unverifiedUserRows: 0,
         rateLimitRows: 7,
      });
   });

   it("logs each failing phase and no summary when nothing could be swept", async () => {
      h.lockRaw.mockRejectedValue(new Error("database is down"));
      await expect(sweepOnce()).resolves.toBeUndefined();

      expect(h.warn.mock.calls.map((call) => call[1].phase)).toEqual([
         "auditRows",
         "orphanedAuditRows",
         "orphanedChainHeads",
         "sessionRows",
         "verificationRows",
         "archiveTicketRows",
         "pendingInvitationRows",
         "unverifiedUserRows",
         "rateLimitRows",
      ]);
      expect(h.info).not.toHaveBeenCalled();
   });
});

describe("pruned watermark", () => {
   it("commits each prefix deletion and its monotonic watermark in one statement", async () => {
      h.expiredServers.mockResolvedValue([SERVER7]);
      deleting({ audit_log: [5000, 12] });
      await sweepOnce();

      expect(h.pruneBatch).toHaveBeenCalledTimes(2);
      for (const call of h.pruneBatch.mock.calls) {
         const sql = textOf(call);
         expect(sql).toContain('DELETE FROM "audit_log"');
         expect(sql).toContain('RETURNING "seq"');
         expect(sql).toContain(
            'UPDATE "audit_chain_head" SET "prunedThroughSeq" = GREATEST( COALESCE("prunedThroughSeq", 0), (SELECT MAX("seq") FROM deleted) )'
         );
         expect(sql).toContain("AND EXISTS (SELECT 1 FROM deleted)");
         expect(sqlOf(call).values).toEqual(["server7", 900, 5000, "server7"]);
      }
      expect(sweepLog()).toMatchObject({ auditRows: 5012 });
   });

   it("keeps the first batch's watermark committed when the next batch fails", async () => {
      h.expiredServers.mockResolvedValue([SERVER7]);
      const committed: string[] = [];
      h.pruneBatch
         .mockImplementationOnce(async (...call: unknown[]) => {
            committed.push(textOf(call));
            return [{ count: 5000 }];
         })
         .mockRejectedValueOnce(new Error("deadlock detected"));
      await sweepOnce();

      expect(committed).toHaveLength(1);
      expect(committed[0]).toContain('UPDATE "audit_chain_head"');
      expect(h.pruneBatch).toHaveBeenCalledTimes(2);
      expect(h.warn).toHaveBeenCalledWith("Maintenance sweep failed", {
         phase: "auditRows",
         error: expect.stringContaining("deadlock detected"),
      });
   });
});

describe("retention floor", () => {
   const retention = () => {
      const sql = sqlOf(h.expiredServers.mock.calls[0] ?? []);
      return {
         text: textOf(h.expiredServers.mock.calls[0] ?? []),
         values: sql.values,
      };
   };

   it("raises a server's retention, or the instance default it falls back to, to the floor", async () => {
      h.minRetentionDays = 90;
      await sweepOnce();

      const { text, values } = retention();
      expect(text).toContain(
         'make_interval( days => GREATEST( COALESCE(NULLIF(s."auditRetentionDays", 0), $2::int), $3::int ) )'
      );
      expect(values.slice(0, 3)).toEqual([NOW.toISOString(), 30, 90]);
   });

   it("still keeps everything when no retention is set at all", async () => {
      h.retentionDays = 0;
      await sweepOnce();

      const { text, values } = retention();
      expect(text).toContain(
         'AND COALESCE(NULLIF(s."auditRetentionDays", 0), $5::int) > 0'
      );
      expect(values[4]).toBe(0);
   });
});

describe("prune record", () => {
   it("records what a prune removed, through the newest expired row", async () => {
      h.expiredServers.mockResolvedValue([SERVER7]);
      deleting({ audit_log: [5000, 12] });
      await sweepOnce();

      expect(h.writeAudit).toHaveBeenCalledExactlyOnceWith({
         serverId: "server7",
         actor: { id: "system", email: "system" },
         audit: { enabled: true, level: "ALL" },
         entry: {
            action: "audit.prune",
            detail: { throughSeq: 900, removed: 5012 },
         },
      });
   });

   it("records nothing when no row was removed", async () => {
      h.expiredServers.mockResolvedValue([SERVER7]);
      deleting({ audit_log: [0] });
      await sweepOnce();
      expect(h.writeAudit).not.toHaveBeenCalled();
   });

   it("logs a prune it could not record and carries on with the next server", async () => {
      h.expiredServers.mockResolvedValue([SERVER7, { id: "server8", seq: 4 }]);
      deleting({ audit_log: [3, 4] });
      h.writeAudit.mockRejectedValueOnce(new Error("database is down"));
      await sweepOnce();

      expect(h.writeAudit).toHaveBeenCalledTimes(2);
      expect(h.error).toHaveBeenCalledWith("Could not record an audit prune", {
         serverId: "server7",
         throughSeq: 900,
         removed: 3,
         error: expect.stringContaining("database is down"),
      });
      expect(h.warn).not.toHaveBeenCalled();
      expect(sweepLog()).toMatchObject({ auditRows: 7 });
   });
});

describe("sweep lock", () => {
   it("takes the same advisory lock once per phase, each on its own pinned connection", async () => {
      h.expiredServers.mockResolvedValue([SERVER7]);
      await sweepOnce();

      expect(h.lockRaw).toHaveBeenCalledTimes(9);
      expect(h.transaction).toHaveBeenCalledTimes(9);
      for (const call of h.lockRaw.mock.calls) {
         expect(textOf(call)).toBe(
            "SELECT pg_try_advisory_xact_lock( $1::int4, $2::int4 ) AS locked"
         );
         expect(sqlOf(call).values).toEqual([
            LOCK_NAMESPACE.MAINTENANCE_SWEEP,
            1_742_318_045,
         ]);
      }
      expect(h.transaction).toHaveBeenLastCalledWith({
         isolationLevel: "ReadCommitted",
         timeout: 50 * 60_000,
      });
      expect(Object.keys(sweepLog() as object)).toEqual([
         "auditRows",
         "orphanedAuditRows",
         "orphanedChainHeads",
         "sessionRows",
         "verificationRows",
         "archiveTicketRows",
         "pendingInvitationRows",
         "unverifiedUserRows",
         "rateLimitRows",
      ]);
   });

   it("stops the sweep at the first phase another replica is holding", async () => {
      h.lockRaw
         .mockResolvedValueOnce([{ locked: true }])
         .mockResolvedValue([{ locked: false }]);
      await sweepOnce();

      expect(h.sweepRateLimits).not.toHaveBeenCalled();
      expect(h.debug).not.toHaveBeenCalled();
      expect(h.info).toHaveBeenCalledWith("Maintenance sweep (partial)", {
         auditRows: expect.any(Number),
         skippedAt: "orphanedAuditRows",
      });
   });

   it("leaves the sweep to whichever replica holds the lock", async () => {
      h.lockRaw.mockResolvedValue([{ locked: false }]);
      h.expiredServers.mockResolvedValue([SERVER7]);
      await sweepOnce();

      expect(h.expiredServers).not.toHaveBeenCalled();
      expect(h.sweepRateLimits).not.toHaveBeenCalled();
      expect(h.executeRaw).not.toHaveBeenCalled();
      expect(h.info).not.toHaveBeenCalled();
      expect(h.warn).not.toHaveBeenCalled();
      expect(h.debug).toHaveBeenCalledWith(
         "Maintenance sweep is already running"
      );
   });
});

describe("orphaned audit rows", () => {
   const orphans = (...serverIds: string[]) =>
      h.queryRaw.mockResolvedValue(serverIds.map((serverId) => ({ serverId })));

   it("clears the log of a server that is gone, in bounded batches", async () => {
      orphans("goneA", "goneB");
      deleting({ audit_log: [5000, 11, 4] });
      await sweepOnce();

      expect(
         deletesFrom("audit_log").map((call) => sqlOf(call).values[0])
      ).toEqual(["goneA", "goneA", "goneB"]);
      expect(textOf(h.executeRaw.mock.calls[0] ?? [])).toBe(
         'DELETE FROM "audit_log" WHERE "id" IN ( SELECT "id" FROM "audit_log" WHERE "serverId" = $1 AND "createdAt" < $2::timestamp LIMIT $3 )'
      );
      expect(sweepLog()).toMatchObject({ orphanedAuditRows: 5015 });
   });

   it("keeps a deleted server's rows until they pass the longer of the retention and its floor", async () => {
      orphans("goneA");
      deleting({ audit_log: [1] });
      h.retentionDays = 30;
      h.minRetentionDays = 90;
      await sweepOnce();
      expect(sqlOf(deletesFrom("audit_log")[0] ?? []).values).toEqual([
         "goneA",
         cutoff(90),
         5000,
      ]);

      vi.clearAllMocks();
      orphans("goneA");
      deleting({ audit_log: [1] });
      h.retentionDays = 0;
      await sweepOnce();
      expect(sqlOf(deletesFrom("audit_log")[0] ?? []).values[1]).toBe(
         cutoff(90)
      );

      vi.clearAllMocks();
      orphans("goneA");
      deleting({ audit_log: [1] });
      h.retentionDays = 365;
      await sweepOnce();
      expect(sqlOf(deletesFrom("audit_log")[0] ?? []).values[1]).toBe(
         cutoff(365)
      );
   });

   it("drops a deleted server's chain head only once no row of it remains", async () => {
      await sweepOnce();
      const [heads] = deletesFrom("audit_chain_head");
      expect(textOf(heads ?? [])).toBe(
         'DELETE FROM "audit_chain_head" WHERE NOT EXISTS ( SELECT 1 FROM "server" WHERE "server"."id" = "audit_chain_head"."serverId" ) AND NOT EXISTS ( SELECT 1 FROM "audit_log" WHERE "audit_log"."serverId" = "audit_chain_head"."serverId" )'
      );
   });

   it("finds them by walking the log's servers, not by reading its rows", async () => {
      orphans();
      h.minRetentionDays = 90;
      await sweepOnce();

      const [walk] = callsMatching(h.queryRaw, "RECURSIVE");
      expect(textOf(walk ?? [])).toContain(
         'SELECT "serverId" FROM "audit_log" WHERE "serverId" > walk."serverId" ORDER BY "serverId" LIMIT 1'
      );
      expect(textOf(walk ?? [])).toContain(
         'NOT EXISTS ( SELECT 1 FROM "server" WHERE "server"."id" = walk."serverId" )'
      );
      // a server deleted minutes ago has nothing to purge yet, so the walk leaves it out.
      expect(textOf(walk ?? [])).toContain(
         'AND EXISTS ( SELECT 1 FROM "audit_log" WHERE "audit_log"."serverId" = walk."serverId" AND "audit_log"."createdAt" < $1::timestamp )'
      );
      expect(sqlOf(walk ?? []).values).toEqual([cutoff(90)]);
      expect(deletesFrom("audit_log")).toEqual([]);
      expect(sweepLog()).toMatchObject({ orphanedAuditRows: 0 });
   });
});

describe("expired records", () => {
   it("prunes expired sessions and those past the absolute cap, verifications, archive tickets and invitations in bounded batches", async () => {
      deleting({
         session: [5000, 2],
         archive_ticket: [5000, 3],
         pending_invitation: [5000, 5000, 1],
      });
      await sweepOnce();

      const [session] = deletesFrom("session");
      expect(textOf(session ?? [])).toBe(
         'DELETE FROM "session" WHERE "id" IN ( SELECT "id" FROM "session" WHERE "expiresAt" <= $1::timestamp OR "createdAt" <= $2::timestamp LIMIT $3 )'
      );
      expect(sqlOf(session ?? []).values).toEqual([
         NOW.toISOString(),
         cutoff(SESSION_ABSOLUTE_TTL_DAYS),
         5000,
      ]);
      expect(deletesFrom("session")).toHaveLength(2);
      expect(deletesFrom("verification")).toHaveLength(1);
      expect(deletesFrom("archive_ticket")).toHaveLength(2);
      for (const call of deletesFrom("archive_ticket")) {
         expect(textOf(call)).toBe(
            'DELETE FROM "archive_ticket" WHERE "id" IN ( SELECT "id" FROM "archive_ticket" WHERE "expiresAt" <= $1::timestamp LIMIT $2 )'
         );
         expect(sqlOf(call).values).toEqual([NOW.toISOString(), 5000]);
      }
      expect(deletesFrom("pending_invitation")).toHaveLength(3);
      for (const call of deletesFrom("pending_invitation")) {
         expect(textOf(call)).toBe(
            'DELETE FROM "pending_invitation" WHERE "id" IN ( SELECT "id" FROM "pending_invitation" WHERE "expiresAt" <= $1::timestamp LIMIT $2 )'
         );
         expect(sqlOf(call).values).toEqual([NOW.toISOString(), 5000]);
      }
      expect(sweepLog()).toMatchObject({
         sessionRows: 5002,
         verificationRows: 0,
         archiveTicketRows: 5003,
         pendingInvitationRows: 10_001,
      });
   });
});

describe("unverified accounts", () => {
   it("deletes week-old unverified accounts that own and joined nothing, in bounded batches", async () => {
      deleting({ user: [5000, 7] });
      await sweepOnce();

      const deletes = deletesFrom("user");
      expect(deletes).toHaveLength(2);
      const text = textOf(deletes[0] ?? []);
      expect(text).toContain('u."emailVerified" = false');
      expect(text).toContain('u."createdAt" < $1::timestamp');
      for (const guard of [
         'NOT EXISTS (SELECT 1 FROM "server" WHERE "ownerId" = u."id")',
         'NOT EXISTS ( SELECT 1 FROM "server_access" WHERE "userId" = u."id" )',
         'NOT EXISTS ( SELECT 1 FROM "bucket_access" WHERE "userId" = u."id" )',
         'NOT EXISTS ( SELECT 1 FROM "pending_invitation" WHERE "invitedById" = u."id" )',
      ])
         expect(text).toContain(guard);
      expect(text).toMatch(/LIMIT \$2 \)$/);
      expect(sqlOf(deletes[0] ?? []).values).toEqual([cutoff(7), 5000]);
      expect(sweepLog()).toMatchObject({ unverifiedUserRows: 5007 });
   });

   it("honours a configured TTL and keeps every account when it is 0", async () => {
      h.unverifiedTtlDays = 30;
      await sweepOnce();
      expect(sqlOf(deletesFrom("user")[0] ?? []).values[0]).toBe(cutoff(30));

      vi.clearAllMocks();
      h.unverifiedTtlDays = 0;
      await sweepOnce();
      expect(deletesFrom("user")).toEqual([]);
      expect(sweepLog()).toMatchObject({ unverifiedUserRows: 0 });
   });
});

describe("boot sweep", () => {
   it("waits a jittered minute or more before the first sweep", async () => {
      const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
      vi.useFakeTimers({ now: NOW });
      try {
         startMaintenance();
         const delay = BOOT_DELAY_MS + BOOT_JITTER_MS / 2;
         await vi.advanceTimersByTimeAsync(delay - 1);
         expect(h.lockRaw).not.toHaveBeenCalled();
         await vi.advanceTimersByTimeAsync(1);
         expect(h.lockRaw).toHaveBeenCalled();
      } finally {
         vi.useRealTimers();
         random.mockRestore();
      }
   });
});
