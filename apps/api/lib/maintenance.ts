import { env } from "@/lib/env";
import { describeError, logger } from "@/lib/logger";
import { prisma } from "@s3-viewer/db";
import { sweepRateLimits } from "@s3-viewer/db/rate-limit";
import { DAY_MS, HOUR_MS } from "@s3-viewer/types";

const PRUNE_BATCH = 5000;
const PRUNE_PAUSE_MS = 50;

// the first sweep after an operator sets AUDIT_RETENTION_DAYS can face years of
// backlog: delete it in bounded statements so one long lock cannot stall writes
const pruneAuditLog = async (now: Date): Promise<number> => {
   if (env.AUDIT_RETENTION_DAYS === 0) return 0;
   const cutoff = new Date(now.getTime() - env.AUDIT_RETENTION_DAYS * DAY_MS);
   let total = 0;
   for (;;) {
      const count = await prisma.$executeRaw`
         DELETE FROM "audit_log" WHERE "id" IN (
            SELECT "id" FROM "audit_log"
            WHERE "createdAt" < ${cutoff}
            ORDER BY "createdAt"
            LIMIT ${PRUNE_BATCH}
         )`;
      total += count;
      if (count < PRUNE_BATCH) return total;
      await new Promise((resolve) => setTimeout(resolve, PRUNE_PAUSE_MS));
   }
};

const sweep = async (): Promise<void> => {
   const now = new Date();
   try {
      const auditRows = await pruneAuditLog(now);
      const rateLimitRows = await sweepRateLimits(now);
      logger.info("Maintenance sweep", { auditRows, rateLimitRows });
   } catch (err) {
      // every replica runs this; a failing sweep must never take the api down
      logger.warn("Maintenance sweep failed", { error: describeError(err) });
   }
};

const startMaintenance = (): void => {
   void sweep();
   setInterval(() => void sweep(), HOUR_MS).unref();
};

export { startMaintenance };
