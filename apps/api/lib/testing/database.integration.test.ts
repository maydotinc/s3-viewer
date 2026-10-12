import { prisma } from "@s3-viewer/db";
import { hitRateLimit, sweepRateLimits } from "@s3-viewer/db/rate-limit";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentOf, hashOf, setAuditChainKey } from "../audit/chain";
import { listAuditPage, verifyAuditChain } from "../audit/query";
import { logger } from "../logger";
import { LOCK_NAMESPACE } from "../db-locks";
import { startMaintenance } from "../maintenance";
import {
   assertDisposableDatabase,
   forkWorker,
   integrationUrl,
   isDisposableDatabase,
} from "./integration";

const run = `integration-${randomUUID()}`;
const rateKey = `${run}-rate`;
const serverId = `${run}-audit`;
const timestampServerId = `${run}-timestamps`;
const maintenanceServerId = `${run}-maintenance`;
const ownerId = `${run}-owner`;
const WORKERS = 4;
const HITS_PER_WORKER = 32;
const AUDITS_PER_WORKER = 24;

const concurrentWorkers = async (mode: string, key: string, count: number) => {
   const children: ReturnType<typeof forkWorker>["child"][] = [];
   const ready: Promise<void>[] = [];
   const results: Promise<number[]>[] = [];
   try {
      for (let worker = 0; worker < WORKERS; worker++) {
         const { child, output } = forkWorker(
            new URL("./database-worker.ts", import.meta.url),
            [mode, key, `worker-${worker}`, String(count)],
            { timeout: 45_000 }
         );
         children.push(child);
         ready.push(
            new Promise((resolve, reject) => {
               child.on("message", (message: { ready?: boolean }) => {
                  if (message.ready) resolve();
               });
               child.once("error", reject);
               child.once("exit", (code) => {
                  reject(
                     new Error(
                        `Worker exited before ready: ${code}\n${output()}`
                     )
                  );
               });
            })
         );
         results.push(
            new Promise((resolve, reject) => {
               let hits: number[] | undefined;
               child.on("message", (message: { hits?: number[] }) => {
                  hits = message.hits ?? hits;
               });
               child.once("error", reject);
               child.once("exit", (code) => {
                  if (code === 0 && hits) resolve(hits);
                  else reject(new Error(`Worker failed: ${code}\n${output()}`));
               });
            })
         );
      }
      const completed = Promise.all(results);
      const started = Promise.all(ready).then(() => {
         for (const child of children) child.send({ start: true });
      });
      const [, hits] = await Promise.all([started, completed]);
      return hits.flat();
   } finally {
      for (const child of children) {
         if (child.exitCode === null) child.kill("SIGTERM");
      }
   }
};

describe.skipIf(!integrationUrl)("disposable PostgreSQL invariants", () => {
   beforeAll(async () => {
      assertDisposableDatabase("Integration checks");
      await prisma.$connect();
      const [session] = await prisma.$queryRaw<{ timezone: string }[]>`
         SELECT current_setting('TimeZone') AS timezone
      `;
      expect(session?.timezone).toBe("America/Toronto");
      setAuditChainKey(Buffer.from("disposable-database-integration-key"));
   });

   afterAll(async () => {
      if (!isDisposableDatabase()) return;
      try {
         await prisma.rateLimit.deleteMany({
            where: { key: { startsWith: run } },
         });
         const servers = [serverId, timestampServerId, maintenanceServerId];
         await prisma.auditLog.deleteMany({
            where: { serverId: { in: servers } },
         });
         await prisma.auditChainHead.deleteMany({
            where: { serverId: { in: servers } },
         });
         await prisma.verification.deleteMany({
            where: { id: { startsWith: run } },
         });
         await prisma.user.deleteMany({ where: { id: ownerId } });
      } finally {
         await prisma.$disconnect();
      }
   });

   it("atomically counts concurrent replica hits and resets an expired window", async () => {
      const hits = await concurrentWorkers(
         "rate-limit",
         rateKey,
         HITS_PER_WORKER
      );
      expect(hits.sort((a, b) => a - b)).toEqual(
         Array.from(
            { length: WORKERS * HITS_PER_WORKER },
            (_, index) => index + 1
         )
      );
      expect(
         await prisma.rateLimit.findUnique({ where: { key: rateKey } })
      ).toMatchObject({
         hits: WORKERS * HITS_PER_WORKER,
         resetAt: new Date("2030-01-01T00:01:00.000Z"),
      });
      expect(
         await hitRateLimit(
            rateKey,
            60_000,
            new Date("2030-01-01T00:01:00.000Z")
         )
      ).toEqual({
         hits: 1,
         resetAt: new Date("2030-01-01T00:02:00.000Z"),
      });
   }, 60_000);

   it("keeps UTC expiry boundaries for existing counters and rate-limit sweeps", async () => {
      const now = new Date("2030-01-01T00:00:00.000Z");
      const expiredKey = `${run}-expired`;
      const activeKey = `${run}-active`;
      await prisma.rateLimit.createMany({
         data: [
            { key: expiredKey, hits: 7, resetAt: now },
            {
               key: activeKey,
               hits: 7,
               resetAt: new Date(now.getTime() + 1),
            },
         ],
      });
      expect(await hitRateLimit(expiredKey, 60_000, now)).toEqual({
         hits: 1,
         resetAt: new Date(now.getTime() + 60_000),
      });
      expect(await hitRateLimit(activeKey, 60_000, now)).toEqual({
         hits: 8,
         resetAt: new Date(now.getTime() + 1),
      });
      await sweepRateLimits(new Date(now.getTime() + 1));
      expect(
         await prisma.rateLimit.findUnique({ where: { key: activeKey } })
      ).toBeNull();
      expect(
         await prisma.rateLimit.findUnique({ where: { key: expiredKey } })
      ).toMatchObject({ hits: 1 });
   });

   it("filters and pages audit timestamps in UTC, including equal-time ties", async () => {
      const from = new Date("2030-01-01T12:00:00.000Z");
      const to = new Date(from.getTime() + 60_000);
      const dates = [
         new Date(from.getTime() - 1),
         from,
         from,
         to,
         new Date(to.getTime() + 1),
      ];
      const ids = dates.map((_, index) => `${run}-audit-time-${index}`);
      await prisma.auditLog.createMany({
         data: dates.map((createdAt, index) => ({
            id: ids[index]!,
            serverId: timestampServerId,
            seq: index + 1,
            actorId: ownerId,
            actorEmail: `${ownerId}@example.com`,
            action: "object.delete",
            bucket: index % 2 ? "photos" : "docs",
            prevHash: "",
            hash: "timestamp-fixture",
            createdAt,
         })),
      });
      for (const reach of [
         null,
         {
            buckets: ["photos", "docs"],
            ownBuckets: [],
            actorId: ownerId,
            serverWide: false,
         },
      ]) {
         const seen: string[] = [];
         let cursor: string | undefined;
         for (let page = 0; page < dates.length; page++) {
            const result = await listAuditPage({
               serverId: timestampServerId,
               reach,
               from,
               to,
               limit: 1,
               cursor,
            });
            seen.push(...result.entries.map((entry) => entry.id));
            if (!result.nextCursor) break;
            cursor = result.nextCursor;
         }
         expect(seen).toEqual([ids[3], ids[2], ids[1]]);
      }
   });

   it("serializes independent audit writers into a complete, verifiable chain", async () => {
      let writers: Promise<number[]> | undefined;
      try {
         await prisma.$transaction(
            async (tx) => {
               await tx.$executeRaw`
               SELECT pg_advisory_xact_lock(
                  ${LOCK_NAMESPACE.AUDIT_APPEND}::int4, hashtext(${serverId})
               )
            `;
               writers = concurrentWorkers(
                  "audit",
                  serverId,
                  AUDITS_PER_WORKER
               );
               void writers.catch(() => {});
               const deadline = Date.now() + 20_000;
               let waiting = 0;
               while (Date.now() < deadline) {
                  const [row] = await prisma.$queryRaw<{ count: number }[]>`
                  SELECT count(*)::int AS count FROM pg_stat_activity
                  WHERE datname = current_database() AND wait_event = 'advisory'
               `;
                  waiting = row!.count;
                  if (waiting === WORKERS) break;
                  await new Promise((resolve) => setTimeout(resolve, 50));
               }
               expect(waiting).toBe(WORKERS);
               expect(await tx.auditLog.count({ where: { serverId } })).toBe(0);
            },
            { timeout: 30_000 }
         );
      } finally {
         await writers;
      }
      const rows = await prisma.auditLog.findMany({
         where: { serverId },
         orderBy: { seq: "asc" },
      });
      expect(rows).toHaveLength(WORKERS * AUDITS_PER_WORKER);
      expect(new Set(rows.map((row) => row.target)).size).toBe(rows.length);
      for (const [index, row] of rows.entries()) {
         expect(row.seq).toBe(index + 1);
         expect(row.prevHash).toBe(index === 0 ? "" : rows[index - 1]!.hash);
         expect(row.hash).toBe(hashOf(contentOf(row)));
      }
      expect(
         await prisma.auditChainHead.findUnique({ where: { serverId } })
      ).toMatchObject({
         seq: rows.length,
         hash: rows.at(-1)!.hash,
      });
      expect(await verifyAuditChain(serverId)).toMatchObject({
         ok: true,
         rows: rows.length,
         truncated: false,
      });
   }, 60_000);

   it("prunes sessions, verifications and retained audit rows at UTC cutoffs", async () => {
      const now = new Date("2030-01-01T00:00:00.000Z");
      const cutoff = new Date("2029-10-03T00:00:00.000Z");
      await prisma.user.create({
         data: {
            id: ownerId,
            name: "Timestamp integration owner",
            email: `${ownerId}@example.com`,
            emailVerified: true,
         },
      });
      await prisma.server.create({
         data: {
            id: maintenanceServerId,
            name: "Timestamp retention",
            ownerId,
            credentials: "integration-fixture",
            auditRetentionDays: 90,
         },
      });
      const expiryDates = [-1, 0, 1].map(
         (offset) => new Date(now.getTime() + offset)
      );
      await prisma.session.createMany({
         data: expiryDates.map((expiresAt, index) => ({
            id: `${run}-session-${index}`,
            token: `${run}-token-${index}`,
            userId: ownerId,
            expiresAt,
         })),
      });
      await prisma.verification.createMany({
         data: expiryDates.map((expiresAt, index) => ({
            id: `${run}-verification-${index}`,
            identifier: ownerId,
            value: "integration-fixture",
            expiresAt,
         })),
      });
      await prisma.auditLog.createMany({
         data: [-1, 0, 1].map((offset, index) => ({
            id: `${run}-retention-${index}`,
            serverId: maintenanceServerId,
            seq: index + 1,
            actorId: ownerId,
            actorEmail: `${ownerId}@example.com`,
            action: "object.delete",
            prevHash: "",
            hash: "timestamp-fixture",
            createdAt: new Date(cutoff.getTime() + offset),
         })),
      });
      await prisma.auditChainHead.create({
         data: {
            serverId: maintenanceServerId,
            seq: 3,
            hash: "timestamp-fixture",
         },
      });
      try {
         vi.useFakeTimers({ now, toFake: ["Date", "setInterval"] });
         const completed = new Promise<void>((resolve, reject) => {
            vi.spyOn(logger, "info").mockImplementation((message) => {
               if (message === "Maintenance sweep") resolve();
            });
            vi.spyOn(logger, "warn").mockImplementation((message, fields) => {
               reject(new Error(`${message}: ${JSON.stringify(fields)}`));
            });
         });
         startMaintenance(0);
         await completed;
      } finally {
         vi.clearAllTimers();
         vi.useRealTimers();
         vi.restoreAllMocks();
      }
      expect(
         await prisma.session.findMany({
            where: { userId: ownerId },
            select: { id: true },
         })
      ).toEqual([{ id: `${run}-session-2` }]);
      expect(
         await prisma.verification.findMany({
            where: { identifier: ownerId },
            select: { id: true },
         })
      ).toEqual([{ id: `${run}-verification-2` }]);
      expect(
         await prisma.auditLog.findMany({
            where: { serverId: maintenanceServerId },
            select: { seq: true },
            orderBy: { seq: "asc" },
         })
      ).toEqual([{ seq: 2 }, { seq: 3 }, { seq: 4 }]);
      expect(
         await prisma.auditChainHead.findUnique({
            where: { serverId: maintenanceServerId },
         })
      ).toMatchObject({ prunedThroughSeq: 1 });
   });
});
