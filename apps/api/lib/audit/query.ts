import {
   chainSelect,
   contentOf,
   hashOf,
   type ChainLink,
   type ChainRow,
} from "./chain";
import { decodeCursor, keysetAfter, pageOf, type Position } from "@/lib/cursor";
import { ApiHttpError, rateLimited } from "@/lib/http";
import { logger } from "@/lib/logger";
import { Prisma, type AuditLog } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   AUDIT_ACTIONS,
   type AuditAction,
   type AuditDetail,
   type AuditLogEntry,
   type AuditLogPage,
   type AuditVerification,
} from "@s3-viewer/types";

const EXPORT_BATCH = 1000;
const VERIFY_BATCH = 1000;
const VERIFY_MAX_ROWS = 100_000;
const VERIFY_CONCURRENCY = 2;
// outlives the statement timeout so Postgres cancels the query before Prisma gives up.
const SEARCH_TRANSACTION_MS = 10_000;
const VERIFY_TRANSACTION_MS = 30_000;
const QUERY_CANCELED = "57014";

type AuditRow = Omit<AuditLog, "serverId">;
type AuditExportRow = AuditLogEntry &
   Pick<AuditRow, "seq" | "prevHash" | "hash">;

type AuditReach = {
   buckets: string[];
   ownBuckets: string[];
   actorId: string;
   serverWide: boolean;
};

type AuditFilters = {
   serverId: string;
   reach: AuditReach | null;
   // who is reading, so an owner is not shown another server's end of a transfer they cannot reach.
   viewerId?: string | undefined;
   action?: string | undefined;
   actor?: string | undefined;
   bucket?: string | undefined;
   q?: string | undefined;
   from?: Date | undefined;
   to?: Date | undefined;
};

const AUDIT_COLUMNS = Prisma.sql`
   "id", "seq", "action", "actorId", "actorEmail", "bucket", "target",
   "detail", "prevHash", "hash", "createdAt"`;

const escapeLikePattern = (value: string): string =>
   value.replace(/[\\%_]/g, "\\$&");

// a LIKE prefix cannot use the (serverId, action, …) index under the default collation, but the
// vocabulary is closed, so the prefix becomes the exact actions it names; none means no rows.
const actionsNamed = (prefix: string): string[] =>
   AUDIT_ACTIONS.filter((action) => action.startsWith(prefix));

const ownActivity = ({ ownBuckets, actorId }: AuditReach): Prisma.Sql =>
   Prisma.sql`("bucket" IN (${Prisma.join(ownBuckets)}) AND "actorId" = ${actorId})`;

const within = (reach: AuditReach): Prisma.Sql => {
   const { buckets, ownBuckets, serverWide } = reach;
   const reachable = [
      ...(buckets.length > 0
         ? [Prisma.sql`"bucket" IN (${Prisma.join(buckets)})`]
         : []),
      ...(ownBuckets.length > 0 ? [ownActivity(reach)] : []),
      ...(serverWide ? [Prisma.sql`"bucket" IS NULL`] : []),
   ];
   return reachable.length > 0
      ? Prisma.sql`(${Prisma.join(reachable, " OR ")})`
      : Prisma.sql`false`;
};

const bucketIs = (bucket: string | null): Prisma.Sql =>
   bucket === null
      ? Prisma.sql`"bucket" IS NULL`
      : Prisma.sql`"bucket" = ${bucket}`;

const OWN_ACTIVITY: unique symbol = Symbol("own activity");
type Branch = string | null | typeof OWN_ACTIVITY;

const branchesFor = (
   { buckets, ownBuckets, serverWide }: AuditReach,
   bucket: string | undefined
): Branch[] => {
   if (bucket) return buckets.includes(bucket) ? [bucket] : [];
   const branches: Branch[] = [...new Set(buckets)];
   if (serverWide) branches.push(null);
   if (ownBuckets.length > 0) branches.push(OWN_ACTIVITY);
   return branches;
};

const REACH_BRANCHES = 32;

const conditionsFor = (
   { serverId, reach, action, actor, bucket, q, from, to }: AuditFilters,
   position: Position | undefined,
   branch?: Branch
): Prisma.Sql[] => [
   Prisma.sql`"serverId" = ${serverId}`,
   ...(branch === undefined
      ? reach
         ? [within(reach)]
         : []
      : branch === OWN_ACTIVITY
        ? reach
           ? [ownActivity(reach)]
           : []
        : [bucketIs(branch)]),
   ...(position ? [keysetAfter(position, "desc")] : []),
   ...(action
      ? [Prisma.sql`"action" = ANY(${actionsNamed(action)}::text[])`]
      : []),
   ...(actor ? [Prisma.sql`"actorId" = ${actor}`] : []),
   ...(bucket && branch === undefined
      ? [Prisma.sql`"bucket" = ${bucket}`]
      : []),
   ...(q ? [Prisma.sql`"target" ILIKE ${`%${escapeLikePattern(q)}%`}`] : []),
   ...(from
      ? [Prisma.sql`"createdAt" >= ${from.toISOString()}::timestamp`]
      : []),
   ...(to ? [Prisma.sql`"createdAt" <= ${to.toISOString()}::timestamp`] : []),
];

const seekOf = (
   filters: AuditFilters,
   position: Position | undefined,
   take: number,
   branch?: Branch
): Prisma.Sql => Prisma.sql`
      SELECT ${AUDIT_COLUMNS}
      FROM "audit_log"
      WHERE ${Prisma.join(conditionsFor(filters, position, branch), " AND ")}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${take}`;

const queryRows = (
   db: Pick<Prisma.TransactionClient, "$queryRaw">,
   filters: AuditFilters,
   position: Position | undefined,
   take: number
): Promise<AuditRow[]> => {
   const branches = filters.reach
      ? branchesFor(filters.reach, filters.bucket)
      : [];
   if (branches.length < 2 || branches.length > REACH_BRANCHES) {
      return db.$queryRaw<AuditRow[]>`${seekOf(filters, position, take)}`;
   }
   const seeks = branches.map(
      (branch) => Prisma.sql`(${seekOf(filters, position, take, branch)})`
   );
   return db.$queryRaw<AuditRow[]>`
      SELECT ${AUDIT_COLUMNS}
      FROM (${Prisma.join(seeks, " UNION ALL ")}) AS "reach"
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${take}`;
};

const isStatementTimeout = (error: unknown): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError &&
   error.code === "P2010" &&
   String(error.meta?.code) === QUERY_CANCELED;

// any filter can walk a server's whole log, holding a pooled connection throughout.
const timedRows = async (
   filters: AuditFilters,
   position: Position | undefined,
   take: number
): Promise<AuditRow[]> => {
   try {
      return await prisma.$transaction(
         async (tx) => {
            await tx.$executeRaw`SET LOCAL statement_timeout = '8s'`;
            return queryRows(tx, filters, position, take);
         },
         { timeout: SEARCH_TRANSACTION_MS, maxWait: SEARCH_TRANSACTION_MS }
      );
   } catch (error) {
      if (!isStatementTimeout(error)) throw error;
      throw new ApiHttpError(
         422,
         "This search took too long. Narrow the search with more text, a date range or another filter."
      );
   }
};

const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS);

const isAuditDetail = (value: unknown): value is AuditDetail =>
   typeof value === "object" &&
   value !== null &&
   !Array.isArray(value) &&
   Object.values(value).every(
      (field) =>
         field === null ||
         typeof field === "string" ||
         typeof field === "number" ||
         typeof field === "boolean"
   );

const toEntry = (row: AuditRow): AuditLogEntry => {
   if (!AUDIT_ACTION_SET.has(row.action)) {
      logger.warn("Audit row has an unknown action", {
         id: row.id,
         action: row.action,
      });
   }
   const detail = isAuditDetail(row.detail) ? row.detail : null;
   if (row.detail !== null && detail === null) {
      logger.warn("Audit row has an unreadable detail", { id: row.id });
   }
   return {
      id: row.id,
      action: row.action as AuditAction,
      actorId: row.actorId,
      actorEmail: row.actorEmail,
      bucket: row.bucket,
      target: row.target,
      detail,
      createdAt: row.createdAt.toISOString(),
   };
};

const OTHER_END: Readonly<
   Record<string, { server: string; bucket: string; fields: string[] }>
> = {
   "object.transfer": {
      server: "fromServerId",
      bucket: "fromBucket",
      fields: ["from", "fromBucket", "fromServerId"],
   },
   "object.download": {
      server: "toServerId",
      bucket: "toBucket",
      fields: ["toBucket", "toServerId"],
   },
};

const foreignServers = (
   entries: readonly AuditLogEntry[],
   serverId: string
): string[] => {
   const ids = new Set<string>();
   for (const { action, detail } of entries) {
      const other = OTHER_END[action];
      const end = other && detail?.[other.server];
      if (typeof end === "string" && end !== serverId) ids.add(end);
   }
   return [...ids];
};

// only an owner (no reach) can be a member of the other server; a bucket-limited viewer sees no foreign end.
const joinedServers = async (
   entries: readonly AuditLogEntry[],
   { serverId, reach, viewerId }: AuditFilters
): Promise<ReadonlySet<string>> => {
   const ids = reach ? [] : foreignServers(entries, serverId);
   if (!viewerId || ids.length === 0) return new Set();
   const rows = await prisma.serverAccess.findMany({
      where: { userId: viewerId, serverId: { in: ids } },
      select: { serverId: true },
   });
   return new Set(rows.map((row) => row.serverId));
};

const withReachableEnds = (
   entry: AuditLogEntry,
   { serverId, reach, viewerId }: AuditFilters,
   joined: ReadonlySet<string>
): AuditLogEntry => {
   const { detail } = entry;
   const other = OTHER_END[entry.action];
   if (!detail || !other || entry.actorId === (reach?.actorId ?? viewerId))
      return entry;
   const bucket = detail[other.bucket];
   if (bucket === undefined) return entry;
   const end = detail[other.server];
   const reachable = reach
      ? typeof bucket === "string" &&
        end === serverId &&
        reach.buckets.includes(bucket)
      : typeof end === "string" && (end === serverId || joined.has(end));
   if (reachable) return entry;
   return {
      ...entry,
      detail: Object.fromEntries(
         Object.entries(detail).filter(
            ([field]) => !other.fields.includes(field)
         )
      ),
   };
};

const listAuditPage = async ({
   cursor,
   limit,
   ...filters
}: AuditFilters & {
   cursor?: string | undefined;
   limit: number;
}): Promise<AuditLogPage> => {
   const rows = await timedRows(
      filters,
      cursor ? decodeCursor(cursor) : undefined,
      limit + 1
   );
   const { page, nextCursor } = pageOf(rows, limit);
   const entries = page.map(toEntry);
   const joined = await joinedServers(entries, filters);
   return {
      entries: entries.map((entry) =>
         withReachableEnds(entry, filters, joined)
      ),
      nextCursor,
   };
};

async function* iterateAudit(
   filters: AuditFilters
): AsyncGenerator<AuditExportRow> {
   let position: Position | undefined;
   for (;;) {
      const rows = await timedRows(filters, position, EXPORT_BATCH);
      const entries = rows.map(toEntry);
      const joined = await joinedServers(entries, filters);
      for (const [index, row] of rows.entries()) {
         const { seq, prevHash, hash } = row;
         yield {
            ...withReachableEnds(entries[index]!, filters, joined),
            seq,
            prevHash,
            hash,
         };
      }
      const last = rows.at(-1);
      if (rows.length < EXPORT_BATCH || !last) return;
      position = last;
   }
}

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

let verifications = 0;

const enterVerification = (): (() => void) => {
   if (verifications >= VERIFY_CONCURRENCY) {
      throw rateLimited(
         "Another integrity check is already running. Try again shortly."
      );
   }
   verifications++;
   let released = false;
   return () => {
      if (released) return;
      released = true;
      verifications--;
   };
};

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

const verifyAuditChain = async (
   serverId: string,
   caller: { closed: boolean } = { closed: false },
   window: VerifyWindow = {}
): Promise<AuditVerification> => {
   const release = enterVerification();
   try {
      return await prisma.$transaction(
         (tx) => verifySnapshot(tx, serverId, caller, window),
         { isolationLevel: "RepeatableRead", timeout: VERIFY_TRANSACTION_MS }
      );
   } finally {
      release();
   }
};

export { iterateAudit, listAuditPage, verifyAuditChain };
export type { AuditExportRow, AuditReach };
