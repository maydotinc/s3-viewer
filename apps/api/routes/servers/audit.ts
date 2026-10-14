import { env } from "@/lib/env";
import { ApiHttpError, rateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getAuditContext, getAuth, refuse } from "@/lib/middleware/authorize";
import {
   auditBulkLimit,
   auditSearchLimit,
   auditVerifyLimit,
} from "@/lib/middleware/rate-limit";
import { strictOriginCheck } from "@/lib/middleware/origin";
import { auditRoute } from "@/lib/middleware/route";
import {
   iterateAudit,
   listAuditPage,
   verifyAuditChain,
   type AuditExportRow,
} from "@/lib/audit/query";
import { recentlySeen } from "@/lib/audit/writer";
import { record, recordWithin } from "@/lib/middleware/audit-record";
import { requireFreshSession } from "@/lib/middleware/fresh-session";
import { memberRole } from "@/lib/services/members";
import {
   auditSettingsOf,
   auditSettingsSelect,
   lockAuditSettings,
} from "@/lib/services/servers";
import { prisma } from "@s3-viewer/db";
import { auditAccess } from "@s3-viewer/permissions";
import {
   MINUTE_MS,
   Role,
   auditQuerySchema,
   auditSettingsSchema,
   describeError,
   serverScope,
   type AuditQuery,
   type AuditSettingsInput,
} from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";
import { once } from "node:events";
import { z } from "zod";

const auditRouter: Router = Router();

const auditExportSchema = auditQuerySchema.omit({ cursor: true, limit: true });
type AuditExportQuery = z.infer<typeof auditExportSchema>;

const OWNER_FIELDS = [
   "viewRole",
   "manageRole",
   "retentionDays",
   "level",
] as const;

const csvCell = (value: string | null): string => {
   const text = value ?? "";
   const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
   return `"${safe.replace(/"/g, '""')}"`;
};

const csvLine = (values: readonly (string | null)[]): string =>
   values.map(csvCell).join(",") + "\r\n";

const CSV_HEADER = csvLine([
   "seq",
   "createdAt",
   "actorEmail",
   "actorId",
   "action",
   "bucket",
   "target",
   "detail",
   "prevHash",
   "hash",
]);

const EXPORT_DEADLINE_MS = 15 * MINUTE_MS;
const MAX_USER_EXPORTS = 1;
const MAX_SERVER_EXPORTS = 2;

// a cut-off export must not pass for the whole log, so its last row says so.
const TRUNCATED_ROW = csvLine([
   null,
   null,
   null,
   null,
   "export.truncated",
   null,
   null,
   JSON.stringify({
      reason: `stopped after ${EXPORT_DEADLINE_MS / MINUTE_MS} minutes; narrow the date range`,
   }),
   null,
   null,
]);

const csvRow = (entry: AuditExportRow): string =>
   csvLine([
      String(entry.seq),
      entry.createdAt,
      entry.actorEmail,
      entry.actorId,
      entry.action,
      entry.bucket,
      entry.target,
      entry.detail && JSON.stringify(entry.detail),
      entry.prevHash,
      entry.hash,
   ]);

const getSettings = async (_req: Request, res: Response) => {
   res.json({ settings: getAuditContext(res).settings });
};

// a stored value below the floor is pruned at the floor anyway, so leaving it alone must save.
const assertRetentionFloor = (
   retentionDays: number | undefined,
   current: number
): void => {
   const floor = env.AUDIT_RETENTION_MIN_DAYS;
   if (
      retentionDays !== undefined &&
      retentionDays !== current &&
      retentionDays > 0 &&
      retentionDays < floor
   )
      throw new ApiHttpError(
         400,
         `Retention can't be shorter than ${floor} days. Use ${floor} or more, or 0 for the default.`
      );
};

const updateSettings = async (
   req: Request,
   res: Response,
   patch: AuditSettingsInput
) => {
   const { serverId, enabled, viewRole, manageRole, retentionDays, level } =
      patch;
   const auth = getAuth(res);
   const settings = await prisma.$transaction(async (tx) => {
      const current = await lockAuditSettings(tx, serverId);
      const serverRole = await memberRole(tx, auth.userId, serverId);
      auth.audit = { enabled: current.enabled, level: current.level };
      if (!serverRole || !auditAccess(serverRole, current).canManage) {
         throw refuse(res, "audit.manage", "audit");
      }
      const ownerOnlyChange =
         (enabled === false && current.enabled) ||
         OWNER_FIELDS.some(
            (field) =>
               patch[field] !== undefined && patch[field] !== current[field]
         );
      if (ownerOnlyChange && serverRole !== Role.OWNER) {
         throw refuse(
            res,
            "audit.manage",
            "audit",
            "Only the owner can change that"
         );
      }
      if (ownerOnlyChange)
         requireFreshSession(req, "changing audit log settings");
      assertRetentionFloor(retentionDays, current.retentionDays);
      const server = await tx.server.update({
         where: { id: serverId },
         data: {
            auditEnabled: enabled,
            auditViewRole: viewRole,
            auditManageRole: manageRole,
            auditRetentionDays: retentionDays,
            auditLevel: level,
         },
         select: auditSettingsSelect,
      });
      const updated = auditSettingsOf(server);
      // inside the transaction, so a disable cannot commit unrecorded.
      await recordWithin(tx, res, {
         action: "audit.settings_change",
         detail: {
            ...updated,
            wasEnabled: current.enabled,
            wasViewRole: current.viewRole,
            wasManageRole: current.manageRole,
            wasRetentionDays: current.retentionDays,
            wasLevel: current.level,
         },
      });
      return updated;
   });
   res.json({ settings });
};

const getAuditLog = async (_req: Request, res: Response, input: AuditQuery) => {
   const { cursor, limit, ...filters } = input;
   const { reach } = getAuditContext(res);
   const { userId } = getAuth(res);
   const page = await listAuditPage({
      ...filters,
      reach,
      viewerId: userId,
      cursor,
      limit,
   });
   if (!recentlySeen(`audit.view:${userId}:${filters.serverId}`)) {
      await record(res, { action: "audit.view" });
   }
   res.json(page);
};

const auditVerifySchema = serverScope.extend({
   fromSeq: z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .default(0),
});
type AuditVerifyQuery = z.infer<typeof auditVerifySchema>;

const verifyAuditLog = async (
   _req: Request,
   res: Response,
   input: AuditVerifyQuery
) => {
   const { reach } = getAuditContext(res);
   if (reach && !reach.serverWide) throw refuse(res, "audit.verify", "audit");
   res.json(
      await verifyAuditChain(
         input.serverId,
         res,
         { fromSeq: input.fromSeq },
         getAuth(res).userId
      )
   );
};

// per process, like the streams it protects; released when the response closes, however it ends.
const exportsRunning = new Map<string, number>();
const running = (key: string): number => exportsRunning.get(key) ?? 0;

const claimExportSlot = (res: Response, serverId: string): void => {
   const { userId, serverRole } = getAuth(res);
   const userKey = `user:${userId}`;
   const serverKey = `server:${serverId}`;
   if (running(userKey) >= MAX_USER_EXPORTS)
      throw rateLimited(
         "You already have an export running. Try again once it finishes."
      );
   // viewers holding the shared slots must not lock the people who manage the log out of it.
   const canManage = auditAccess(
      serverRole,
      getAuditContext(res).settings
   ).canManage;
   const keys = canManage ? [userKey] : [userKey, serverKey];
   if (!canManage && running(serverKey) >= MAX_SERVER_EXPORTS)
      throw rateLimited(
         "Other exports are running on this server. Try again once they finish."
      );
   for (const key of keys) exportsRunning.set(key, running(key) + 1);
   res.once("close", () => {
      for (const key of keys) {
         const left = running(key) - 1;
         if (left > 0) exportsRunning.set(key, left);
         else exportsRunning.delete(key);
      }
   });
};

const exportAuditLog = async (
   _req: Request,
   res: Response,
   filters: AuditExportQuery
) => {
   const { action = null, actor = null, bucket = null, q = null } = filters;
   const { reach } = getAuditContext(res);
   claimExportSlot(res, filters.serverId);
   await record(res, {
      action: "audit.export",
      detail: {
         action,
         actor,
         bucket,
         q,
         from: filters.from?.toISOString() ?? null,
         to: filters.to?.toISOString() ?? null,
      },
   });
   const day = new Date().toISOString().slice(0, 10);
   res.setHeader("Content-Type", "text/csv; charset=utf-8");
   res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-${filters.serverId}-${day}.csv"`
   );
   res.write(CSV_HEADER);
   const closed = new AbortController();
   res.once("close", () => closed.abort());
   const deadline = Date.now() + EXPORT_DEADLINE_MS;
   try {
      for await (const entry of iterateAudit({
         ...filters,
         reach,
         viewerId: getAuth(res).userId,
      })) {
         if (closed.signal.aborted) return;
         if (Date.now() > deadline) {
            logger.warn("Audit export hit its deadline", {
               serverId: filters.serverId,
            });
            res.end(TRUNCATED_ROW);
            return;
         }
         if (!res.write(csvRow(entry))) {
            try {
               await once(res, "drain", {
                  signal: AbortSignal.any([
                     closed.signal,
                     AbortSignal.timeout(env.UPLOAD_IDLE_TIMEOUT_MS),
                  ]),
               });
            } catch {
               res.destroy();
               return;
            }
         }
      }
      res.end();
   } catch (err) {
      logger.warn("Audit export failed", {
         serverId: filters.serverId,
         error: describeError(err),
      });
      res.destroy(err instanceof Error ? err : new Error(String(err)));
   }
};

auditRouter.get(
   "/:serverId/audit/settings",
   ...auditRoute("manage", serverScope, getSettings)
);
auditRouter.patch(
   "/:serverId/audit/settings",
   ...auditRoute("manage", auditSettingsSchema, updateSettings)
);
auditRouter.get(
   "/:serverId/audit",
   strictOriginCheck,
   auditSearchLimit,
   ...auditRoute("view", auditQuerySchema, getAuditLog)
);
auditRouter.get(
   "/:serverId/audit/verify",
   auditVerifyLimit,
   ...auditRoute("view", auditVerifySchema, verifyAuditLog)
);
auditRouter.get(
   "/:serverId/audit/export",
   strictOriginCheck,
   auditBulkLimit,
   ...auditRoute("view", auditExportSchema, exportAuditLog)
);

export { auditRouter };
