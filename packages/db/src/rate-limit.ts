import { ttlMap } from "@s3-viewer/types";
import { prisma } from "./client";
import { deleteBatches } from "./delete-batches";

type RateLimitHit = { hits: number; resetAt: Date };

const hitRateLimit = async (
   key: string,
   windowMs: number,
   now: Date = new Date()
): Promise<RateLimitHit> => {
   // bind ISO text: timestamptz-to-timestamp casts would apply the session time zone.
   const at = now.toISOString();
   const resetAt = new Date(now.getTime() + windowMs).toISOString();
   const rows = await prisma.$queryRaw<RateLimitHit[]>`
      INSERT INTO "rate_limit" ("key", "hits", "resetAt")
      VALUES (${key}, 1, ${resetAt}::timestamp)
      ON CONFLICT ("key") DO UPDATE SET
         "hits" = CASE
            WHEN "rate_limit"."resetAt" <= ${at}::timestamp THEN 1
            ELSE "rate_limit"."hits" + 1
         END,
         "resetAt" = CASE
            WHEN "rate_limit"."resetAt" <= ${at}::timestamp THEN ${resetAt}::timestamp
            ELSE "rate_limit"."resetAt"
         END
      RETURNING "hits", "resetAt"
   `;
   const [row] = rows;
   if (!row) throw new Error("rate_limit upsert returned no row");
   return row;
};

const undoRateLimitHit = async (key: string): Promise<void> => {
   await prisma.$executeRaw`
      UPDATE "rate_limit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${key}
   `;
};

type WindowCounter = {
   hit: (key: string, windowMs: number, now?: number) => Promise<number>;
   undo: (key: string) => Promise<void>;
};

type MemoryWindows = {
   hit: (key: string, windowMs: number, now?: number) => number;
   undo: (key: string) => void;
};

// the same fixed window as the rate_limit table: it starts at the first hit, counts refused hits
// too and resets on the first hit after it ends, so RATE_LIMIT_STORE=memory behaves the same.
const memoryWindows = (maxKeys: number): MemoryWindows => {
   const windows = ttlMap<string, { hits: number; resetAt: number }>(maxKeys);
   return {
      hit: (key, windowMs, now = Date.now()) => {
         const live = windows.get(key, now);
         const window = live
            ? { hits: live.hits + 1, resetAt: live.resetAt }
            : { hits: 1, resetAt: now + windowMs };
         windows.set(key, window, window.resetAt, now);
         return window.hits;
      },
      // like the table's undo it ignores resetAt; an expired window restarts on its next hit anyway.
      undo: (key) => {
         const window = windows.get(key, -Infinity);
         if (window) window.hits = Math.max(window.hits - 1, 0);
      },
   };
};

const memoryWindowCounter = (maxKeys: number): WindowCounter => {
   const windows = memoryWindows(maxKeys);
   return {
      hit: async (key, windowMs, now) => windows.hit(key, windowMs, now),
      undo: async (key) => windows.undo(key),
   };
};

const sharedWindowCounter: WindowCounter = {
   hit: async (key, windowMs, now = Date.now()) =>
      (await hitRateLimit(key, windowMs, new Date(now))).hits,
   undo: undoRateLimitHit,
};

const resetRateLimit = async (key: string): Promise<void> => {
   await prisma.$executeRaw`DELETE FROM "rate_limit" WHERE "key" = ${key}`;
};

const sweepRateLimits = (now: Date = new Date()): Promise<number> =>
   deleteBatches(
      (limit) => prisma.$executeRaw`
         DELETE FROM "rate_limit" WHERE "key" IN (
            SELECT "key" FROM "rate_limit"
            WHERE "resetAt" <= ${now.toISOString()}::timestamp
            LIMIT ${limit}
         )`
   );

export {
   hitRateLimit,
   memoryWindowCounter,
   memoryWindows,
   resetRateLimit,
   sharedWindowCounter,
   sweepRateLimits,
   undoRateLimitHit,
};
export type { WindowCounter };
