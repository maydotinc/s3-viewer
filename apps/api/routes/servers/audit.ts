import { env } from "@/lib/env";
import { ApiHttpError } from "@/lib/http";
import { getAuditContext, getAuth, refuse } from "@/lib/middleware/authorize";
import {
   auditBulkLimit,
   auditSearchLimit,
   auditVerifyLimit,
} from "@/lib/middleware/rate-limit";
import { strictOriginCheck } from "@/lib/middleware/origin";
import { auditRoute } from "@/lib/middleware/route";
import { claimExportSlot, streamAuditExport } from "@/lib/audit/export";
import { INT4_MAX, listAuditPage, verifyAuditChain } from "@/lib/audit/query";
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
   Role,
   auditQuerySchema,
   auditSettingsSchema,
   serverScope,
   type AuditQuery,
   type AuditSettingsInput,
} from "@s3-viewer/shared";
import { Router, type Request, type Response } from "express";
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
   fromSeq: z.coerce.number().int().min(0).max(INT4_MAX).default(0),
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

const exportAuditLog = async (
   _req: Request,
   res: Response,
   filters: AuditExportQuery
) => {
   const { action = null, actor = null, bucket = null, q = null } = filters;
   const { reach, settings } = getAuditContext(res);
   const { userId, serverRole } = getAuth(res);
   const release = claimExportSlot({
      userId,
      serverId: filters.serverId,
      canManage: auditAccess(serverRole, settings).canManage,
   });
   // wired before the first await, so a client gone during the audit write still frees the slot and starts no read.
   const closed = new AbortController();
   closed.signal.addEventListener("abort", release, { once: true });
   res.once("close", () => closed.abort());
   if (res.destroyed) closed.abort();
   // the bucket filter is the row's bucket so readers outside it never see the row; the search text stays the exporter's.
   await record(res, {
      action: "audit.export",
      ...(bucket !== null && { bucket }),
      detail: {
         action,
         actor,
         searched: q !== null,
         from: filters.from?.toISOString() ?? null,
         to: filters.to?.toISOString() ?? null,
      },
   });
   await streamAuditExport(
      { ...filters, reach, viewerId: userId },
      {
         out: res,
         closed: closed.signal,
         begin: () => {
            const day = new Date().toISOString().slice(0, 10);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader(
               "Content-Disposition",
               `attachment; filename="audit-${filters.serverId}-${day}.csv"`
            );
         },
      }
   );
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
