import { prisma } from "./client";

type RateLimitHit = { hits: number; resetAt: Date };

// one atomic upsert per hit: a key past its window starts a new one, so every
// replica sees the same count without a lock
const hitRateLimit = async (
   key: string,
   windowMs: number,
   now: Date = new Date()
): Promise<RateLimitHit> => {
   const resetAt = new Date(now.getTime() + windowMs);
   const rows = await prisma.$queryRaw<RateLimitHit[]>`
      INSERT INTO "rate_limit" ("key", "hits", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
         "hits" = CASE
            WHEN "rate_limit"."resetAt" <= ${now} THEN 1
            ELSE "rate_limit"."hits" + 1
         END,
         "resetAt" = CASE
            WHEN "rate_limit"."resetAt" <= ${now} THEN ${resetAt}
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

const resetRateLimit = async (key: string): Promise<void> => {
   await prisma.$executeRaw`DELETE FROM "rate_limit" WHERE "key" = ${key}`;
};

const sweepRateLimits = async (now: Date = new Date()): Promise<number> =>
   prisma.$executeRaw`DELETE FROM "rate_limit" WHERE "resetAt" <= ${now}`;

export { hitRateLimit, resetRateLimit, sweepRateLimits, undoRateLimitHit };
export type { RateLimitHit };
