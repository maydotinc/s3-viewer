import { writeAudit } from "./audit/writer";
import { LOCK_NAMESPACE, tryXactLock } from "./db-locks";
import { env } from "./env";
import { logger } from "./logger";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { deleteBatches } from "@s3-viewer/db/delete-batches";
import { sweepRateLimits } from "@s3-viewer/db/rate-limit";
import {
   AuditLevel,
   DAY_MS,
   HOUR_MS,
   MINUTE_MS,
   SESSION_ABSOLUTE_TTL_DAYS,
   describeError,
} from "@s3-viewer/types";

const SERVER_PAGE = 500;
const SWEEP_LOCK_KEY = 1_742_318_045;
const PHASE_LEASE_MS = 50 * MINUTE_MS;
const BOOT_DELAY_MS = MINUTE_MS;
const BOOT_JITTER_MS = 2 * MINUTE_MS;

const SYSTEM_ACTOR = { id: "system", email: "system" };

const daysBefore = (now: Date, days: number): Date =>
   new Date(now.getTime() - days * DAY_MS);

// a recursive seek avoids scanning every row for DISTINCT serverId, and only servers with
// something past the cutoff come back, so recent churn costs the sweep no DELETE round trips.
const orphanedServerIds = (cutoff: string): Promise<{ serverId: string }[]> =>
   prisma.$queryRaw<{ serverId: string }[]>`
      WITH RECURSIVE walk AS (
         (SELECT "serverId" FROM "audit_log" ORDER BY "serverId" LIMIT 1)
         UNION ALL
         SELECT (
            SELECT "serverId" FROM "audit_log"
            WHERE "serverId" > walk."serverId"
            ORDER BY "serverId"
            LIMIT 1
         )
         FROM walk
         WHERE walk."serverId" IS NOT NULL
      )
      SELECT walk."serverId" FROM walk
      WHERE walk."serverId" IS NOT NULL
        AND NOT EXISTS (
           SELECT 1 FROM "server" WHERE "server"."id" = walk."serverId"
        )
        AND EXISTS (
           SELECT 1 FROM "audit_log"
           WHERE "audit_log"."serverId" = walk."serverId"
             AND "audit_log"."createdAt" < ${cutoff}::timestamp
        )`;

// a deleted server's log is evidence of who deleted it, so it outlives the server by the retention floor.
const purgeOrphanedAudits = async (now: Date): Promise<number> => {
   const cutoff = daysBefore(
      now,
      Math.max(env.AUDIT_RETENTION_DAYS, env.AUDIT_RETENTION_MIN_DAYS)
   ).toISOString();
   let total = 0;
   for (const { serverId } of await orphanedServerIds(cutoff)) {
      total += await deleteBatches(
         (limit) => prisma.$executeRaw`
            DELETE FROM "audit_log" WHERE "id" IN (
               SELECT "id" FROM "audit_log"
               WHERE "serverId" = ${serverId}
                 AND "createdAt" < ${cutoff}::timestamp
               LIMIT ${limit}
            )`
      );
   }
   return total;
};

const purgeOrphanedChainHeads = (): Promise<number> =>
   prisma.$executeRaw`
      DELETE FROM "audit_chain_head"
      WHERE NOT EXISTS (
         SELECT 1 FROM "server"
         WHERE "server"."id" = "audit_chain_head"."serverId"
      ) AND NOT EXISTS (
         SELECT 1 FROM "audit_log"
         WHERE "audit_log"."serverId" = "audit_chain_head"."serverId"
      )`;

const SESSION = Prisma.raw('"session"');
const VERIFICATION = Prisma.raw('"verification"');
const ARCHIVE_TICKET = Prisma.raw('"archive_ticket"');
const PENDING_INVITATION = Prisma.raw('"pending_invitation"');

const pruneExpired = (
   table: Prisma.Sql,
   now: Date,
   orWhere: Prisma.Sql = Prisma.empty
): Promise<number> =>
   deleteBatches(
      (limit) => prisma.$executeRaw`
         DELETE FROM ${table} WHERE "id" IN (
            SELECT "id" FROM ${table}
            WHERE "expiresAt" <= ${now.toISOString()}::timestamp ${orWhere}
            LIMIT ${limit}
         )`
   );

// the absolute cap only ends a session on its next request, so one that never returns would stay
// listed until its rolling expiry.
const pruneSessions = (now: Date): Promise<number> =>
   pruneExpired(
      SESSION,
      now,
      Prisma.sql`OR "createdAt" <= ${daysBefore(now, SESSION_ABSOLUTE_TTL_DAYS).toISOString()}::timestamp`
   );

// a server's own retention, or the instance default when it is 0, raised to the floor; 0 after
// that still means forever. only servers with an expired row come back, one query per page.
const expiredServerPage = (
   now: Date,
   after: string
): Promise<{ id: string; seq: number }[]> => {
   const instanceDays = env.AUDIT_RETENTION_DAYS;
   return prisma.$queryRaw<{ id: string; seq: number }[]>`
      SELECT s."id", newest."seq" FROM "server" s
      CROSS JOIN LATERAL (
         SELECT "seq" FROM "audit_log"
         WHERE "serverId" = s."id"
           AND "createdAt" < ${now.toISOString()}::timestamp - make_interval(
              days => GREATEST(
                 COALESCE(NULLIF(s."auditRetentionDays", 0), ${instanceDays}::int),
                 ${env.AUDIT_RETENTION_MIN_DAYS}::int
              )
           )
         ORDER BY "createdAt" DESC, "seq" DESC
         LIMIT 1
      ) newest
      WHERE s."id" > ${after}
        AND COALESCE(NULLIF(s."auditRetentionDays", 0), ${instanceDays}::int) > 0
      ORDER BY s."id"
      LIMIT ${SERVER_PAGE}`;
};

const pruneServer = async (
   serverId: string,
   newestExpired: number
): Promise<number> => {
   const removed = await deleteBatches(async (limit) => {
      const [batch] = await prisma.$queryRaw<{ count: number }[]>`
         WITH deleted AS (
            DELETE FROM "audit_log" WHERE "id" IN (
               SELECT "id" FROM "audit_log"
               WHERE "serverId" = ${serverId} AND "seq" <= ${newestExpired}
               ORDER BY "seq"
               LIMIT ${limit}
            )
            RETURNING "seq"
         ), advanced AS (
            UPDATE "audit_chain_head"
            SET "prunedThroughSeq" = GREATEST(
               COALESCE("prunedThroughSeq", 0), (SELECT MAX("seq") FROM deleted)
            )
            WHERE "serverId" = ${serverId} AND EXISTS (SELECT 1 FROM deleted)
            RETURNING "serverId"
         )
         SELECT COUNT(*)::int AS count FROM deleted`;
      return batch?.count ?? 0;
   });
   if (removed > 0) await recordPrune(serverId, newestExpired, removed);
   return removed;
};

// the rows are already gone, so a failed write is logged rather than aborting the other servers.
const recordPrune = async (
   serverId: string,
   throughSeq: number,
   removed: number
): Promise<void> => {
   try {
      await writeAudit({
         serverId,
         actor: SYSTEM_ACTOR,
         audit: { enabled: true, level: AuditLevel.ALL },
         entry: { action: "audit.prune", detail: { throughSeq, removed } },
      });
   } catch (err) {
      logger.error("Could not record an audit prune", {
         serverId,
         throughSeq,
         removed,
         error: describeError(err),
      });
   }
};

const pruneAuditLog = async (now: Date): Promise<number> => {
   let total = 0;
   let after = "";
   for (;;) {
      const servers = await expiredServerPage(now, after);
      for (const { id, seq } of servers) total += await pruneServer(id, seq);
      const last = servers.at(-1)?.id;
      if (servers.length < SERVER_PAGE || last === undefined) return total;
      after = last;
   }
};

// unverified accounts cannot own or join servers, so one with neither is only sign-up residue.
const pruneUnverifiedUsers = (now: Date): Promise<number> => {
   const days = env.UNVERIFIED_ACCOUNT_TTL_DAYS;
   if (days === 0) return Promise.resolve(0);
   const cutoff = daysBefore(now, days).toISOString();
   return deleteBatches(
      (limit) => prisma.$executeRaw`
         DELETE FROM "user" WHERE "id" IN (
            SELECT "id" FROM "user" AS u
            WHERE u."emailVerified" = false
              AND u."createdAt" < ${cutoff}::timestamp
              AND NOT EXISTS (SELECT 1 FROM "server" WHERE "ownerId" = u."id")
              AND NOT EXISTS (
                 SELECT 1 FROM "server_access" WHERE "userId" = u."id"
              )
              AND NOT EXISTS (
                 SELECT 1 FROM "bucket_access" WHERE "userId" = u."id"
              )
              AND NOT EXISTS (
                 SELECT 1 FROM "pending_invitation" WHERE "invitedById" = u."id"
              )
            LIMIT ${limit}
         )`
   );
};

const SKIPPED = Symbol("skipped");

// deletes run on another connection so each batch commits and releases its row locks.
const underSweepLock = <T>(
   phase: () => Promise<T>
): Promise<T | typeof SKIPPED> =>
   prisma.$transaction(
      async (tx) =>
         (await tryXactLock(
            tx,
            LOCK_NAMESPACE.MAINTENANCE_SWEEP,
            SWEEP_LOCK_KEY
         ))
            ? await phase()
            : SKIPPED,
      { isolationLevel: "ReadCommitted", timeout: PHASE_LEASE_MS }
   );

const phasesOf = (now: Date): [string, () => Promise<number>][] => [
   ["auditRows", () => pruneAuditLog(now)],
   ["orphanedAuditRows", () => purgeOrphanedAudits(now)],
   ["orphanedChainHeads", purgeOrphanedChainHeads],
   ["sessionRows", () => pruneSessions(now)],
   ["verificationRows", () => pruneExpired(VERIFICATION, now)],
   ["archiveTicketRows", () => pruneExpired(ARCHIVE_TICKET, now)],
   ["pendingInvitationRows", () => pruneExpired(PENDING_INVITATION, now)],
   ["unverifiedUserRows", () => pruneUnverifiedUsers(now)],
   ["rateLimitRows", () => sweepRateLimits(now)],
];

const sweep = async (): Promise<void> => {
   const now = new Date();
   const swept: Record<string, number> = {};
   for (const [name, phase] of phasesOf(now)) {
      try {
         const rows = await underSweepLock(phase);
         if (rows === SKIPPED) {
            if (Object.keys(swept).length === 0)
               logger.debug("Maintenance sweep is already running");
            else
               logger.info("Maintenance sweep (partial)", {
                  ...swept,
                  skippedAt: name,
               });
            return;
         }
         swept[name] = rows;
      } catch (err) {
         logger.warn("Maintenance sweep failed", {
            phase: name,
            error: describeError(err),
         });
      }
   }
   if (Object.keys(swept).length > 0) logger.info("Maintenance sweep", swept);
};

// replicas booted together by a rolling deploy would otherwise each sweep back to back.
const bootDelayMs = (): number =>
   BOOT_DELAY_MS + Math.floor(Math.random() * BOOT_JITTER_MS);

const startMaintenance = (firstSweepInMs: number = bootDelayMs()): void => {
   setTimeout(() => void sweep(), firstSweepInMs).unref();
   setInterval(() => void sweep(), HOUR_MS).unref();
};

export { BOOT_DELAY_MS, BOOT_JITTER_MS, startMaintenance };
