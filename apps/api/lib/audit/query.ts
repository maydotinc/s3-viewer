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
import { bump, countOf } from "@/lib/utils/counter-map";
import { Prisma, type AuditLog } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   AUDIT_ACTIONS,
   Role,
   type AuditAction,
   type AuditDetail,
   type AuditLogEntry,
   type AuditLogPage,
   type AuditVerification,
   SECOND_MS,
} from "@s3-viewer/types";

const EXPORT_BATCH = 1000;
const VERIFY_BATCH = 1000;
const VERIFY_MAX_ROWS = 100_000;
// each read holds a pooled connection for up to the statement timeout, so audit keeps most of the pool free.
const READ_CONCURRENCY = 4;
// exports never fill the last slot, so a burst of slow downloads cannot shut every search out.
const EXPORT_READ_CONCURRENCY = READ_CONCURRENCY - 1;
// aborting a request does not cancel its query, so quick filter changes from one person pile up.
const USER_READ_CONCURRENCY = 2;
// outlives the statement timeout so Postgres cancels the query before Prisma gives up.
const SEARCH_TRANSACTION_MS = 10 * SECOND_MS;
const VERIFY_TRANSACTION_MS = 30 * SECOND_MS;
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

const isStatementTimeout = (error: unknown): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError &&
   error.code === "P2010" &&
   String(error.meta?.code) === QUERY_CANCELED;

type ReadSlot = { exporting: boolean; reader: string | undefined };

let reads = 0;
let exportReads = 0;
const searchesBy = new Map<string, number>();
const waitingExports: (() => void)[] = [];

const readsBusy = (): ApiHttpError =>
   rateLimited("Too many audit log reads are running. Try again shortly.");

const exportFits = (): boolean =>
   reads < READ_CONCURRENCY && exportReads < EXPORT_READ_CONCURRENCY;

const takeRead = ({ exporting, reader }: ReadSlot): void => {
   reads++;
   if (exporting) exportReads++;
   if (reader) bump(searchesBy, reader, 1);
};

// a freed slot passes straight to a waiting export, so a search arriving in between cannot take it.
const leaveRead = ({ exporting, reader }: ReadSlot): void => {
   reads--;
   if (exporting) exportReads--;
   if (reader) bump(searchesBy, reader, -1);
   if (waitingExports.length > 0 && exportFits()) waitingExports.shift()!();
};

const waitForRead = (slot: ReadSlot): Promise<void> =>
   new Promise((resolve, reject) => {
      const turn = () => {
         clearTimeout(timer);
         takeRead(slot);
         resolve();
      };
      const timer = setTimeout(() => {
         waitingExports.splice(waitingExports.indexOf(turn), 1);
         reject(readsBusy());
      }, SEARCH_TRANSACTION_MS);
      waitingExports.push(turn);
   });

// an export has already sent its headers, so its batches queue where a search fails fast.
const enterRead = async (slot: ReadSlot): Promise<void> => {
   if (slot.exporting) {
      if (exportFits()) takeRead(slot);
      else await waitForRead(slot);
      return;
   }
   if (
      slot.reader &&
      countOf(searchesBy, slot.reader) >= USER_READ_CONCURRENCY
   ) {
      throw rateLimited(
         "Your earlier audit searches are still running. Try again shortly."
      );
   }
   if (reads >= READ_CONCURRENCY) throw readsBusy();
   takeRead(slot);
};

// any filter can walk a server's whole log, holding a pooled connection throughout.
const timedRows = async (
   filters: AuditFilters,
   position: Position | undefined,
   take: number,
   exporting = false
): Promise<AuditRow[]> => {
   const slot: ReadSlot = {
      exporting,
      reader: exporting
         ? undefined
         : (filters.viewerId ?? filters.reach?.actorId),
   };
   await enterRead(slot);
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
      leaveRead(slot);
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

type ForeignEnds = { owned: ReadonlySet<string>; buckets: ReadonlySet<string> };

const NO_FOREIGN_ENDS: ForeignEnds = { owned: new Set(), buckets: new Set() };

// a bucket name cannot hold a slash, so two ends never share a key.
const endKey = (serverId: string, bucket: string): string =>
   `${serverId}/${bucket}`;

const foreignEnds = (
   entries: readonly AuditLogEntry[],
   serverId: string
): { servers: string[]; buckets: string[] } => {
   const servers = new Set<string>();
   const buckets = new Set<string>();
   for (const { action, detail } of entries) {
      const other = OTHER_END[action];
      if (!other || !detail) continue;
      const end = detail[other.server];
      if (typeof end !== "string" || end === serverId) continue;
      servers.add(end);
      const bucket = detail[other.bucket];
      if (typeof bucket === "string") buckets.add(bucket);
   }
   return { servers: [...servers], buckets: [...buckets] };
};

// only an owner (no reach) is shown a foreign end, and only one they could open there: by owning
// that server or holding a whole-bucket grant, the same test a non-owner gets on this server.
const reachableForeignEnds = async (
   entries: readonly AuditLogEntry[],
   { serverId, reach, viewerId }: AuditFilters
): Promise<ForeignEnds> => {
   const { servers, buckets } = reach
      ? { servers: [], buckets: [] }
      : foreignEnds(entries, serverId);
   if (!viewerId || servers.length === 0) return NO_FOREIGN_ENDS;
   const memberships = await prisma.serverAccess.findMany({
      where: { userId: viewerId, serverId: { in: servers } },
      select: { serverId: true, role: true },
   });
   const owned = memberships
      .filter(({ role }) => role === Role.OWNER)
      .map((row) => row.serverId);
   const joined = memberships
      .filter(({ role }) => role !== Role.OWNER)
      .map((row) => row.serverId);
   const grants =
      joined.length === 0 || buckets.length === 0
         ? []
         : await prisma.bucketAccess.findMany({
              where: {
                 userId: viewerId,
                 serverId: { in: joined },
                 bucketName: { in: buckets },
                 restrictedFolders: false,
              },
              select: { serverId: true, bucketName: true },
           });
   return {
      owned: new Set(owned),
      buckets: new Set(
         grants.map((grant) => endKey(grant.serverId, grant.bucketName))
      ),
   };
};

const withReachableEnds = (
   entry: AuditLogEntry,
   { serverId, reach, viewerId }: AuditFilters,
   foreign: ForeignEnds
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
      : typeof end === "string" &&
        (end === serverId ||
           foreign.owned.has(end) ||
           (typeof bucket === "string" &&
              foreign.buckets.has(endKey(end, bucket))));
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

// member and invite rows list every grant the member holds, so a reader limited to some buckets
// would learn the roles and folders on the rest.
const GRANT_ACTIONS: ReadonlySet<AuditAction> = new Set([
   "member.role_change",
   "invite.send",
   "invite.accept",
]);

// a bucket name holds no comma or colon, so this finds every listed bucket; folder text that
// happens to match only hides more.
const LISTED_BUCKET = /(?:^|,)([A-Za-z0-9._-]+):/g;

const withReachableGrants = (
   entry: AuditLogEntry,
   { reach }: AuditFilters
): AuditLogEntry => {
   const { detail } = entry;
   const listed = detail?.buckets;
   if (!reach || !detail || !GRANT_ACTIONS.has(entry.action)) return entry;
   if (typeof listed !== "string") return entry;
   const held = new Set([...reach.buckets, ...reach.ownBuckets]);
   const hidden = [...listed.matchAll(LISTED_BUCKET)].some(
      ([, bucket]) => !held.has(bucket!)
   );
   if (!hidden) return entry;
   const { buckets: _, ...rest } = detail;
   return { ...entry, detail: rest };
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
   const foreign = await reachableForeignEnds(entries, filters);
   return {
      entries: entries.map((entry) =>
         withReachableGrants(
            withReachableEnds(entry, filters, foreign),
            filters
         )
      ),
      nextCursor,
   };
};

async function* iterateAudit(
   filters: AuditFilters
): AsyncGenerator<AuditExportRow[]> {
   let position: Position | undefined;
   for (;;) {
      const rows = await timedRows(filters, position, EXPORT_BATCH, true);
      const entries = rows.map(toEntry);
      const foreign = await reachableForeignEnds(entries, filters);
      if (rows.length > 0) {
         yield rows.map(({ seq, prevHash, hash }, index) => ({
            ...withReachableGrants(
               withReachableEnds(entries[index]!, filters, foreign),
               filters
            ),
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

// a check pins a pooled connection like a search does, so it draws on the same read slots.
const VERIFY_SLOT: ReadSlot = { exporting: false, reader: undefined };

// one check per server and per person, so neither a long check nor someone with many servers
// can hold every slot.
const verifying = new Set<string>();
const verifyingBy = new Set<string>();

const enterVerification = (
   serverId: string,
   viewerId: string | undefined
): (() => void) => {
   if (verifying.has(serverId)) {
      throw rateLimited(
         "An integrity check is already running on this server. Try again shortly."
      );
   }
   if (viewerId && verifyingBy.has(viewerId)) {
      throw rateLimited(
         "Your earlier integrity check is still running. Try again once it finishes."
      );
   }
   verifying.add(serverId);
   if (viewerId) verifyingBy.add(viewerId);
   let released = false;
   return () => {
      if (released) return;
      released = true;
      verifying.delete(serverId);
      if (viewerId) verifyingBy.delete(viewerId);
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
   window: VerifyWindow = {},
   viewerId?: string
): Promise<AuditVerification> => {
   const release = enterVerification(serverId, viewerId);
   try {
      await enterRead(VERIFY_SLOT);
      try {
         return await prisma.$transaction(
            (tx) => verifySnapshot(tx, serverId, caller, window),
            { isolationLevel: "RepeatableRead", timeout: VERIFY_TRANSACTION_MS }
         );
      } finally {
         leaveRead(VERIFY_SLOT);
      }
   } finally {
      release();
   }
};

export { iterateAudit, listAuditPage, verifyAuditChain };
export type { AuditExportRow, AuditReach };
