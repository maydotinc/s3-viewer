import {
   chainSelect,
   contentOf,
   hashOf,
   type ChainLink,
   type ChainRow,
} from "./chain";
import type { Prisma } from "@prisma/client";
import type { AuditVerification } from "@s3-viewer/shared";

const VERIFY_BATCH = 1000;
const VERIFY_MAX_ROWS = 100_000;

const linked = (
   row: ChainRow,
   previous: ChainLink | null,
   prunedThrough: number
): boolean =>
   previous
      ? row.prevHash === previous.hash && row.seq === previous.seq + 1
      : row.seq === prunedThrough + 1 &&
        (prunedThrough > 0 || row.prevHash === "");

type VerifyWindow = { fromSeq?: number; maxRows?: number };

type Verdict = Pick<AuditVerification, "ok" | "rows" | "firstSeq"> &
   Partial<AuditVerification>;

const verdict = (fields: Verdict): AuditVerification => ({
   lastSeq: null,
   brokenAt: null,
   truncated: false,
   anchorSeq: null,
   nextFromSeq: null,
   ...fields,
});

const verifySnapshot = async (
   tx: Prisma.TransactionClient,
   serverId: string,
   caller: { closed: boolean },
   { fromSeq = 0, maxRows = VERIFY_MAX_ROWS }: VerifyWindow
): Promise<AuditVerification> => {
   const anchor = await tx.auditChainHead.findUnique({
      where: { serverId },
      select: { seq: true, hash: true, prunedThroughSeq: true },
   });
   const prunedThrough = anchor?.prunedThroughSeq ?? 0;
   let rows = 0;
   let firstSeq: number | null = null;
   let previous: ChainLink | null =
      fromSeq > prunedThrough
         ? await tx.auditLog.findFirst({
              where: { serverId, seq: fromSeq },
              select: { seq: true, hash: true },
           })
         : null;
   if (fromSeq > prunedThrough && !previous) {
      return verdict({
         ok: false,
         rows,
         firstSeq,
         brokenAt: fromSeq,
         anchorSeq: anchor?.seq ?? null,
      });
   }
   const rowLimit = Math.min(VERIFY_MAX_ROWS, Math.max(1, maxRows));
   for (;;) {
      const take = Math.min(VERIFY_BATCH, rowLimit - rows);
      const batch = await tx.auditLog.findMany({
         where: { serverId, ...(previous && { seq: { gt: previous.seq } }) },
         orderBy: { seq: "asc" },
         take,
         select: chainSelect,
      });
      for (const row of batch) {
         rows++;
         firstSeq ??= row.seq;
         if (
            !linked(row, previous, prunedThrough) ||
            hashOf(contentOf(row)) !== row.hash
         ) {
            return verdict({
               ok: false,
               rows,
               firstSeq,
               lastSeq: row.seq,
               brokenAt: row.seq,
            });
         }
         previous = row;
      }
      if (!anchor && previous) {
         return verdict({ ok: false, rows, firstSeq, lastSeq: previous.seq });
      }
      if (batch.length < take) {
         const truncated =
            !!anchor &&
            ((anchor.seq > (previous?.seq ?? 0) &&
               anchor.seq > prunedThrough) ||
               (previous !== null &&
                  (anchor.seq < previous.seq ||
                     (anchor.seq === previous.seq &&
                        anchor.hash !== previous.hash))));
         return verdict({
            ok: !truncated,
            rows,
            firstSeq,
            lastSeq: previous?.seq ?? null,
            truncated,
            anchorSeq: anchor?.seq ?? null,
         });
      }
      if (rows >= rowLimit || caller.closed) {
         return verdict({
            ok: true,
            rows,
            firstSeq,
            lastSeq: previous?.seq ?? null,
            nextFromSeq: previous?.seq ?? null,
         });
      }
   }
};

export { verifySnapshot };
export type { VerifyWindow };
