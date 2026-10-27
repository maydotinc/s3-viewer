import { env } from "@/lib/env";
import { rateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { keyedSlots, type Release } from "@/lib/utils/keyed-slots";
import { MINUTE_MS, describeError } from "@s3-viewer/shared";
import type { Writable } from "node:stream";
import { iterateAudit, type AuditExportRow, type AuditFilters } from "./query";

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

// per process, like the streams it protects; the caller releases a claim when its response closes, however it ends.
const exportsRunning = keyedSlots();

const userExporting = () =>
   rateLimited(
      "You already have an export running. Try again once it finishes."
   );

const serverExporting = () =>
   rateLimited(
      "Other exports are running on this server. Try again once they finish."
   );

type ExportClaim = { userId: string; serverId: string; canManage: boolean };

// viewers holding the shared slots must not lock the people who manage the log out of it.
const claimExportSlot = ({
   userId,
   serverId,
   canManage,
}: ExportClaim): Release =>
   exportsRunning.acquire([
      [`user:${userId}`, MAX_USER_EXPORTS, userExporting],
      canManage
         ? undefined
         : [`server:${serverId}`, MAX_SERVER_EXPORTS, serverExporting],
   ]);

type ExportTarget = {
   out: Writable;
   // aborted once the client is gone; no read starts after that.
   closed: AbortSignal;
   // called once the first read has answered, before anything is written.
   begin: () => void;
};

const streamAuditExport = async (
   filters: AuditFilters,
   { out, closed, begin }: ExportTarget
): Promise<void> => {
   if (closed.aborted) return;
   const batches = iterateAudit(filters);
   const deadline = Date.now() + EXPORT_DEADLINE_MS;
   // the first read can still refuse with 429 or 422, so the headers wait for its answer.
   const first = await batches.next();
   begin();
   out.write(CSV_HEADER);
   // compression hands drain listeners to its gzip stream and never removes them, so a single
   // listener serves every wait instead of one leaking per batch.
   let drained: (() => void) | undefined;
   out.on("drain", () => drained?.());
   const waitForDrain = (signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
         if (signal.aborted) return reject(signal.reason);
         const abort = () => reject(signal.reason);
         signal.addEventListener("abort", abort, { once: true });
         drained = () => {
            drained = undefined;
            signal.removeEventListener("abort", abort);
            resolve();
         };
      });
   try {
      for (let step = first; !step.done; step = await batches.next()) {
         const batch = step.value;
         if (closed.aborted) return;
         if (Date.now() > deadline) {
            logger.warn("Audit export hit its deadline", {
               serverId: filters.serverId,
            });
            out.end(TRUNCATED_ROW);
            return;
         }
         if (!out.write(batch.map(csvRow).join(""))) {
            try {
               await waitForDrain(
                  AbortSignal.any([
                     closed,
                     AbortSignal.timeout(env.UPLOAD_IDLE_TIMEOUT_MS),
                  ])
               );
            } catch {
               out.destroy();
               return;
            }
         }
      }
      out.end();
   } catch (err) {
      logger.warn("Audit export failed", {
         serverId: filters.serverId,
         error: describeError(err),
      });
      out.destroy(err instanceof Error ? err : new Error(String(err)));
   } finally {
      void batches.return(undefined);
   }
};

export { claimExportSlot, streamAuditExport };
