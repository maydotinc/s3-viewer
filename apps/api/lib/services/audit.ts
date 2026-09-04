import { describeError, logger } from "@/lib/logger";
import { prisma } from "@s3-viewer/db";
import type { AuditEntry } from "@s3-viewer/types";

const recordAudit = async (entry: AuditEntry): Promise<void> => {
   try {
      await prisma.auditLog.create({
         data: {
            action: entry.action,
            actorId: entry.actorId ?? null,
            serverId: entry.serverId ?? null,
            target: entry.target ?? null,
         },
         select: { id: true },
      });
   } catch (err) {
      logger.warn("Could not record audit entry", {
         action: entry.action,
         error: describeError(err),
      });
   }
};

export { recordAudit };
