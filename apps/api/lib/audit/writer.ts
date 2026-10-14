import { auditRow, type ChainLink, type Queued } from "./chain";
import { LOCK_NAMESPACE, xactLock } from "@/lib/db-locks";
import { logger } from "@/lib/logger";
import type { AuditScope } from "@/lib/services/servers";
import { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { isUniqueViolation } from "@s3-viewer/db/errors";
import { createHash } from "node:crypto";
import {
   AuditLevel,
   MINUTE_MS,
   type AuditAction,
   type AuditEntry,
   describeError,
} from "@s3-viewer/types";

const INSERT_CHUNK = 1000;
const APPEND_SLICE = 5000;
const MAX_APPEND_ATTEMPTS = 64;
const WRITE_TIMEOUT_MS = 30_000;
const WRITE_MAX_WAIT_MS = 10_000;
const FLUSH_INTERVAL_MS = 250;
const FLUSH_AT_ENTRIES = 500;
const MAX_BUFFERED_ENTRIES = 50_000;
const SERVER_BUFFER_SHARE = 0.2;
const MAX_SERVER_ENTRIES = Math.floor(
   MAX_BUFFERED_ENTRIES * SERVER_BUFFER_SHARE
);
// queued reads from every server together leave this much room for durable writes.
const QUEUED_BUFFER_SHARE = 0.8;
const MAX_QUEUED_ENTRIES = Math.floor(
   MAX_BUFFERED_ENTRIES * QUEUED_BUFFER_SHARE
);
const SEEN_WINDOW_MS = 5 * MINUTE_MS;
const READ_WINDOW_MS = MINUTE_MS;
const LOSS_LOG_INTERVAL_MS = MINUTE_MS;
const APPEND_CONCURRENCY = 4;
const SEEN_SWEEP_EVERY = 1000;
const MAX_SEEN_KEYS = 20_000;
// each distinct prefix dodges the dedupe, so a scripted crawl would otherwise write a row per folder.
const MAX_LISTINGS_PER_WINDOW = 30;

const SKIPPED_AT_CHANGES: ReadonlySet<AuditAction> = new Set<AuditAction>([
   "object.list",
   "object.view",
]);

// any member who can browse can repeat these as fast as the rate limit allows.
const DEDUPED_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
   "object.list",
   "object.view",
]);

// everything else is durable: its caller waits for the write and learns when it failed.
const QUEUED_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
   "object.list",
   "object.view",
   "audit.view",
   "access.denied",
]);

class AuditWriteError extends Error {
   constructor() {
      super("Audit entries could not be recorded");
      this.name = "AuditWriteError";
   }
}

type WriteInput = {
   serverId: string;
   actor: { id: string; email: string };
   audit: AuditScope;
};

const recordedAt = (level: AuditLevel, entry: AuditEntry): boolean =>
   level !== AuditLevel.CHANGES || !SKIPPED_AT_CHANGES.has(entry.action);

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// never move an anchor backward: the sequence gap must expose deleted audit rows.
const headOf = async (
   tx: Tx,
   serverId: string,
   reconcile: boolean
): Promise<ChainLink> => {
   const anchor = await tx.auditChainHead.findUnique({
      where: { serverId },
      select: { seq: true, hash: true },
   });
   if (anchor && !reconcile) return anchor;
   const row = await tx.auditLog.findFirst({
      where: { serverId },
      orderBy: { seq: "desc" },
      select: { seq: true, hash: true },
   });
   if (!anchor && row)
      throw new Error("Audit chain head is missing for an existing log");
   if (anchor && (!row || anchor.seq > row.seq)) return anchor;
   return row ?? { seq: 0, hash: "" };
};

const appendWithin = async (
   tx: Tx,
   serverId: string,
   entries: Queued[],
   reconcile = false
): Promise<void> => {
   await xactLock(tx, LOCK_NAMESPACE.AUDIT_APPEND, serverId);
   let last: ChainLink = await headOf(tx, serverId, reconcile);
   const createdAt = new Date();
   for (let i = 0; i < entries.length; i += INSERT_CHUNK) {
      const rows = entries.slice(i, i + INSERT_CHUNK).map((item) => {
         const row = auditRow(serverId, item, last, createdAt);
         last = row;
         return row;
      });
      await tx.auditLog.createMany({ data: rows });
   }
   await tx.auditChainHead.upsert({
      where: { serverId },
      create: { serverId, seq: last.seq, hash: last.hash },
      update: { seq: last.seq, hash: last.hash },
   });
};

const appendChain = (serverId: string, entries: Queued[], reconcile = false) =>
   prisma.$transaction((tx) => appendWithin(tx, serverId, entries, reconcile), {
      isolationLevel: "ReadCommitted",
      timeout: WRITE_TIMEOUT_MS,
      maxWait: WRITE_MAX_WAIT_MS,
   });

// lets a change and its audit row commit or roll back together. take the server row lock first: appenders never wait on it.
const appendAuditWithin = (
   tx: Tx,
   { serverId, actor }: Pick<WriteInput, "serverId" | "actor">,
   entries: AuditEntry[]
): Promise<void> =>
   appendWithin(
      tx,
      serverId,
      entries.map((entry) => ({ actor, entry }))
   );

type Batch = Flush & { entries: Queued[] };

const queue = new Map<string, Batch>();
let queued = 0;
let buffered = 0;
let flushTimer: NodeJS.Timeout | null = null;

type Flush = { done: Promise<void>; complete: () => void };

const newFlush = (): Flush => {
   const { promise: done, resolve: complete } = Promise.withResolvers<void>();
   return { done, complete };
};

const serverFlushes = new Map<string, Flush>();
const ready = new Set<string>();
let activeAppends = 0;
let allFlush: Flush | null = null;

let droppedEntries = 0;
let failedEntries = 0;
let lossLoggedAt = 0;
const bufferedBy = new Map<string, number>();
// a durable caller finds out through this whether its own entries were lost.
const unwritten = new WeakSet<Queued>();

const isDurable = ({ action }: AuditEntry): boolean =>
   !QUEUED_ACTIONS.has(action);

const reportLoss = (serverId: string, count: number, reason: string): void => {
   const now = Date.now();
   if (now - lossLoggedAt < LOSS_LOG_INTERVAL_MS) return;
   lossLoggedAt = now;
   logger.error("Audit entries were not recorded", {
      serverId,
      reason,
      count,
      droppedEntries,
      failedEntries,
      queued,
      buffered,
   });
};

type AuditLoss = { dropped: number; failed: number; flushing: number };

const auditLoss = (): AuditLoss => ({
   dropped: droppedEntries,
   failed: failedEntries,
   flushing: serverFlushes.size,
});

const isDataError = (error: unknown): boolean => {
   if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
   return (
      ["P2000", "P2005", "P2006", "P2007", "P2011", "P2023"].includes(
         error.code
      ) ||
      (error.code === "P2010" && String(error.meta?.code).startsWith("22"))
   );
};

const isRolledBack = (error: unknown): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError &&
   ["P2024", "P2028"].includes(error.code);

const markUnwritten = (items: Queued[]): void => {
   for (const item of items) {
      if (unwritten.has(item)) continue;
      unwritten.add(item);
      failedEntries++;
   }
};

const failWrite = (
   serverId: string,
   pending: Queued[],
   reason: string,
   error?: unknown
): void => {
   markUnwritten(pending);
   const detail = {
      serverId,
      action: pending[0]?.entry.action,
      reason,
      ...(error !== undefined && { error: describeError(error) }),
   };
   if (pending.some(({ entry }) => isDurable(entry)))
      logger.error("Could not record audit entry", detail);
   else if (error !== undefined)
      logger.warn("Could not record audit entry", detail);
   reportLoss(serverId, pending.length, reason);
};

const appendServer = async (
   serverId: string,
   entries: Queued[]
): Promise<void> => {
   let attempts = MAX_APPEND_ATTEMPTS;
   let unavailable = false;
   const append = async (pending: Queued[], retry = true): Promise<void> => {
      if (unavailable || attempts === 0) {
         failWrite(serverId, pending, "write retry limit");
         return;
      }
      try {
         attempts--;
         await appendChain(serverId, pending).catch((error: unknown) => {
            if (!isUniqueViolation(error) || attempts === 0) throw error;
            attempts--;
            return appendChain(serverId, pending, true);
         });
      } catch (error) {
         if (isDataError(error) && pending.length > 1 && attempts > 0) {
            const middle = Math.floor(pending.length / 2);
            await append(pending.slice(0, middle));
            await append(pending.slice(middle));
            return;
         }
         if (isRolledBack(error) && retry && attempts > 0) {
            await append(pending, false);
            return;
         }
         unavailable = !isDataError(error);
         failWrite(serverId, pending, "write failed", error);
      }
   };
   for (let i = 0; i < entries.length; i += APPEND_SLICE)
      await append(entries.slice(i, i + APPEND_SLICE));
};

const completeGlobalFlush = (): void => {
   if (!allFlush || queue.size > 0 || serverFlushes.size > 0) return;
   const finished = allFlush;
   allFlush = null;
   finished.complete();
};

const appendBatch = async (serverId: string, batch: Batch): Promise<void> => {
   try {
      await appendServer(serverId, batch.entries);
   } catch (err) {
      markUnwritten(batch.entries);
      logger.error("Audit flush failed", { error: describeError(err) });
   } finally {
      buffered -= batch.entries.length;
      const held = (bufferedBy.get(serverId) ?? 0) - batch.entries.length;
      if (held > 0) bufferedBy.set(serverId, held);
      else bufferedBy.delete(serverId);
      activeAppends--;
      batch.complete();
      if (queue.has(serverId)) ready.add(serverId);
      else {
         const finished = serverFlushes.get(serverId)!;
         serverFlushes.delete(serverId);
         finished.complete();
      }
      startAppends();
      completeGlobalFlush();
   }
};

const startAppends = (): void => {
   for (const serverId of ready) {
      if (activeAppends >= APPEND_CONCURRENCY) return;
      ready.delete(serverId);
      const batch = queue.get(serverId)!;
      queue.delete(serverId);
      queued -= batch.entries.length;
      activeAppends++;
      void appendBatch(serverId, batch);
   }
};

const flushServer = (serverId: string): Promise<void> => {
   const existing = serverFlushes.get(serverId);
   if (existing) return existing.done;
   if (!queue.has(serverId)) return Promise.resolve();
   const flush = newFlush();
   serverFlushes.set(serverId, flush);
   ready.add(serverId);
   startAppends();
   return flush.done;
};

const flushAudits = (): Promise<void> => {
   if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
   }
   if (allFlush) return allFlush.done;
   const flush = newFlush();
   allFlush = flush;
   for (const serverId of queue.keys()) void flushServer(serverId);
   completeGlobalFlush();
   return flush.done;
};

const flushAuditsWithin = (timeoutMs: number): Promise<void> =>
   new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      void flushAudits().finally(() => {
         clearTimeout(timer);
         resolve();
      });
   });

const scheduleFlush = (serverId: string): void => {
   if (allFlush) {
      void flushServer(serverId);
      return;
   }
   if (queued >= FLUSH_AT_ENTRIES) {
      void flushAudits();
      return;
   }
   if (flushTimer) return;
   flushTimer = setTimeout(() => {
      flushTimer = null;
      void flushAudits();
   }, FLUSH_INTERVAL_MS);
   flushTimer.unref();
};

// a durable write is capped only by the whole buffer, never by its server's share.
const enqueue = (
   serverId: string,
   entries: Queued[],
   durable: boolean
): Batch | null => {
   const held = bufferedBy.get(serverId) ?? 0;
   const refusal = durable
      ? entries.length > MAX_BUFFERED_ENTRIES - buffered && "queue full"
      : held + entries.length > MAX_SERVER_ENTRIES
        ? "server share"
        : buffered + entries.length > MAX_QUEUED_ENTRIES && "queued share";
   if (refusal) {
      droppedEntries += entries.length;
      reportLoss(serverId, entries.length, refusal);
      return null;
   }
   bufferedBy.set(serverId, held + entries.length);
   let batch = queue.get(serverId);
   if (batch) batch.entries.push(...entries);
   else {
      batch = { entries, ...newFlush() };
      queue.set(serverId, batch);
   }
   queued += entries.length;
   buffered += entries.length;
   scheduleFlush(serverId);
   return batch;
};

const readKey = (
   { serverId, actor }: WriteInput,
   { action, bucket, target, detail }: AuditEntry
): string =>
   createHash("sha256")
      .update(
         JSON.stringify([
            action,
            actor.id,
            serverId,
            bucket ?? null,
            target ?? null,
            detail ?? null,
         ])
      )
      .digest("base64url");

const repeatedRead = (scope: WriteInput, entry: AuditEntry): boolean =>
   DEDUPED_ACTIONS.has(entry.action) && recentlyRead(readKey(scope, entry));

// past the cap one marker row stands in for the rest of the window, so the gap is visible.
const throttledListing = (
   { serverId, actor }: WriteInput,
   entry: AuditEntry
): AuditEntry[] => {
   if (entry.action !== "object.list") return [entry];
   const count = recentListings(JSON.stringify([actor.id, serverId]));
   if (count <= MAX_LISTINGS_PER_WINDOW) return [entry];
   if (count > MAX_LISTINGS_PER_WINDOW + 1) return [];
   return [
      {
         action: "object.list",
         bucket: entry.bucket,
         detail: { limited: true, perMinute: MAX_LISTINGS_PER_WINDOW },
      },
   ];
};

// rejects only when a durable entry was not stored; queued reads fail open.
const writeAudits = async ({
   entries,
   ...scope
}: WriteInput & { entries: AuditEntry[] }): Promise<void> => {
   if (!scope.audit.enabled) return;
   const kept = entries.flatMap((entry) =>
      recordedAt(scope.audit.level, entry) && !repeatedRead(scope, entry)
         ? throttledListing(scope, entry)
         : []
   );
   if (kept.length === 0) return;
   const items = kept.map((entry) => ({ actor: scope.actor, entry }));
   const durable = kept.some(isDurable);
   const batch = enqueue(scope.serverId, items, durable);
   if (!durable) return;
   if (!batch) throw new AuditWriteError();
   void flushServer(scope.serverId);
   await batch.done;
   if (items.some((item) => unwritten.has(item))) throw new AuditWriteError();
};

const writeAudit = ({
   entry,
   ...scope
}: WriteInput & { entry: AuditEntry }): Promise<void> =>
   writeAudits({ ...scope, entries: [entry] });

// counts a key's hits in a fixed window that opens at its first hit.
const hitsWithin = (windowMs: number): ((key: string) => number) => {
   const seen = new Map<string, { at: number; hits: number }>();
   let calls = 0;
   const sweep = (now: number): void => {
      for (const [key, { at }] of seen) {
         if (now - at > windowMs) seen.delete(key);
      }
   };
   return (key) => {
      const now = Date.now();
      if (++calls % SEEN_SWEEP_EVERY === 0) sweep(now);
      const window = seen.get(key);
      if (window && now - window.at <= windowMs) return ++window.hits;
      seen.delete(key);
      seen.set(key, { at: now, hits: 1 });
      for (const oldest of seen.keys()) {
         if (seen.size <= MAX_SEEN_KEYS) break;
         seen.delete(oldest);
      }
      return 1;
   };
};

const seenWithin = (windowMs: number): ((key: string) => boolean) => {
   const hits = hitsWithin(windowMs);
   return (key) => hits(key) > 1;
};

const recentlySeen = seenWithin(SEEN_WINDOW_MS);
// kept apart so a flood of distinct reads cannot evict denial keys.
const recentlyRead = seenWithin(READ_WINDOW_MS);
const recentListings = hitsWithin(READ_WINDOW_MS);

export {
   AuditWriteError,
   appendAuditWithin,
   auditLoss,
   flushAudits,
   flushAuditsWithin,
   recentlySeen,
   writeAudit,
   writeAudits,
};
export type { WriteInput };
