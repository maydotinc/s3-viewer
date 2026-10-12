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

export { hitRateLimit, resetRateLimit, sweepRateLimits, undoRateLimitHit };
