import { serverRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { listAuditPage } from "@/lib/services/audit";
import { Permission } from "@s3-viewer/permissions";
import { auditQuerySchema, type AuditQuery } from "@s3-viewer/types";
import { Router, type Request, type Response } from "express";

const auditRouter: Router = Router();

const getAuditLog = async (_req: Request, res: Response) => {
   const { serverId, cursor, limit } = input<AuditQuery>(res);
   res.json(await listAuditPage({ where: { serverId }, cursor, limit }));
};

auditRouter.get(
   "/:serverId/audit",
   ...serverRoute(Permission.MANAGE_MEMBERS, auditQuerySchema, getAuditLog)
);

export { auditRouter };
