import { SEARCH_TRANSACTION_MS, enterRead } from "./read-slots";
import { readableEntries } from "./redaction";
import { verifySnapshot, type VerifyWindow } from "./verify";
import { decodeCursor, keysetAfter, pageOf, type Position } from "@/lib/cursor";
import { ApiHttpError, rateLimited } from "@/lib/http";
import { keyedSlots, type Release } from "@/lib/utils/keyed-slots";
import { Prisma, type AuditLog } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { isStatementTimeout } from "@s3-viewer/db/errors";
import {
   AUDIT_ACTIONS,
   SECOND_MS,
   type AuditAction,
   type AuditLogEntry,
   type AuditLogPage,
   type AuditVerification,
} from "@s3-viewer/shared";

const EXPORT_BATCH = 1000;
const VERIFY_TRANSACTION_MS = 30 * SECOND_MS;
// audit_log.seq is a Postgres int4, so a larger position reaches Prisma as a 500 rather than matching nothing.
const INT4_MAX = 2_147_483_647;

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

// credentials.update names the endpoint and key suffix, which only the owner (who set them) may read.
const OWNER_ONLY_ACTIONS: readonly AuditAction[] = ["credentials.update"];

const serverRows = Prisma.sql`("bucket" IS NULL AND "action" <> ALL(${OWNER_ONLY_ACTIONS}::text[]))`;

const ownActivity = ({ ownBuckets, actorId }: AuditReach): Prisma.Sql =>
   Prisma.sql`("bucket" IN (${Prisma.join(ownBuckets)}) AND "actorId" = ${actorId})`;

const within = (reach: AuditReach): Prisma.Sql => {
   const { buckets, ownBuckets, serverWide } = reach;
   const reachable = [
      ...(buckets.length > 0
         ? [Prisma.sql`"bucket" IN (${Prisma.join(buckets)})`]
         : []),
      ...(ownBuckets.length > 0 ? [ownActivity(reach)] : []),
      ...(serverWide ? [serverRows] : []),
   ];
   return reachable.length > 0
      ? Prisma.sql`(${Prisma.join(reachable, " OR ")})`
      : Prisma.sql`false`;
};

const bucketIs = (bucket: string | null): Prisma.Sql =>
   bucket === null ? serverRows : Prisma.sql`"bucket" = ${bucket}`;

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

// any filter can walk a server's whole log, holding a pooled connection throughout.
const timedRows = async (
   filters: AuditFilters,
   position: Position | undefined,
   take: number,
   exporting = false
): Promise<AuditRow[]> => {
   const leaveRead = await enterRead(
      exporting,
      filters.viewerId ?? filters.reach?.actorId
   );
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
   } finally {
      leaveRead();
   }
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
   return { entries: await readableEntries(page, filters), nextCursor };
};

async function* iterateAudit(
   filters: AuditFilters
): AsyncGenerator<AuditExportRow[]> {
   let position: Position | undefined;
   for (;;) {
      const rows = await timedRows(filters, position, EXPORT_BATCH, true);
      const entries = await readableEntries(rows, filters);
      if (rows.length > 0) {
         yield rows.map(({ seq, prevHash, hash }, index) => ({
            ...entries[index]!,
            seq,
            prevHash,
            hash,
         }));
      }
      const last = rows.at(-1);
      if (rows.length < EXPORT_BATCH || !last) return;
      position = last;
   }
}

// one check per server and per person, so neither a long check nor someone with many servers
// can hold every slot.
const checks = keyedSlots();

const serverChecking = (): ApiHttpError =>
   rateLimited(
      "An integrity check is already running on this server. Try again shortly."
   );

const viewerChecking = (): ApiHttpError =>
   rateLimited(
      "Your earlier integrity check is still running. Try again once it finishes."
   );

const enterVerification = (
   serverId: string,
   viewerId: string | undefined
): Release =>
   checks.acquire([
      [`server:${serverId}`, 1, serverChecking],
      viewerId ? [`user:${viewerId}`, 1, viewerChecking] : undefined,
   ]);

const verifyAuditChain = async (
   serverId: string,
   caller: { closed: boolean } = { closed: false },
   window: VerifyWindow = {},
   viewerId?: string
): Promise<AuditVerification> => {
   const release = enterVerification(serverId, viewerId);
   try {
      // a check pins a pooled connection like a search does, so it draws on the same read slots.
      const leaveRead = await enterRead(false, viewerId);
      try {
         return await prisma.$transaction(
            (tx) => verifySnapshot(tx, serverId, caller, window),
            { isolationLevel: "RepeatableRead", timeout: VERIFY_TRANSACTION_MS }
         );
      } finally {
         leaveRead();
      }
   } finally {
      release();
   }
};

export { INT4_MAX, iterateAudit, listAuditPage, verifyAuditChain };
export type { AuditExportRow, AuditFilters, AuditReach, AuditRow };
