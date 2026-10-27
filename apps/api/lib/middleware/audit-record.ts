import {
   appendAuditWithin,
   writeAudits,
   type WriteInput,
} from "@/lib/audit/writer";
import { ApiHttpError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { getAuth, requireUser } from "./authorize";
import { input } from "./validate";
import {
   ErrorCode,
   describeError,
   type AuditAction,
   type AuditEntry,
} from "@s3-viewer/shared";
import type { Response } from "express";

// the work these gate has not started, so an unrecorded one must not proceed.
const RECORDED_FIRST: ReadonlySet<AuditAction> = new Set<AuditAction>([
   "object.download",
   "object.archive",
   "audit.export",
]);

const auditUnavailable = (): ApiHttpError =>
   new ApiHttpError(
      503,
      "The audit log is unavailable, so this action was not carried out. Try again shortly.",
      ErrorCode.AUDIT_UNAVAILABLE
   );

// a mutation that already happened is reported as done, but never silently unrecorded.
const settled = async (
   write: Promise<void>,
   serverId: string,
   entries: readonly AuditEntry[]
): Promise<void> => {
   try {
      await write;
   } catch (error) {
      if (entries.some(({ action }) => RECORDED_FIRST.has(action)))
         throw auditUnavailable();
      logger.error("audit write failed after action", {
         serverId,
         actions: entries.map(({ action }) => action),
         error: describeError(error),
      });
   }
};

const scopeOf = (res: Response): WriteInput => {
   const { userId, audit } = getAuth(res);
   return {
      serverId: input<{ serverId: string }>(res).serverId,
      actor: { id: userId, email: requireUser(res.req).email },
      audit,
   };
};

const recordMany = (res: Response, entries: AuditEntry[]): Promise<void> => {
   const scope = scopeOf(res);
   return settled(writeAudits({ ...scope, entries }), scope.serverId, entries);
};

const record = (res: Response, entry: AuditEntry): Promise<void> =>
   recordMany(res, [entry]);

// writes inside the caller's transaction, so the change cannot commit unrecorded.
const recordWithin = (
   tx: Parameters<typeof appendAuditWithin>[0],
   res: Response,
   entry: AuditEntry
): Promise<void> => {
   const { serverId, actor } = scopeOf(res);
   return appendAuditWithin(tx, { serverId, actor }, [entry]);
};

// for routes without an authorize gate, where the scope comes from the server row the handler loaded.
const recordManyFor = (
   { id, email }: WriteInput["actor"],
   serverId: string,
   audit: WriteInput["audit"],
   entries: AuditEntry[]
): Promise<void> =>
   settled(
      writeAudits({ serverId, actor: { id, email }, audit, entries }),
      serverId,
      entries
   );

export { auditUnavailable, record, recordMany, recordManyFor, recordWithin };
