import { ApiHttpError } from "@/lib/http";
import { describeError, logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import type {
   AuditAction,
   AuditEntry,
   AuditLogEntry,
   AuditLogPage,
} from "@s3-viewer/types";

const auditRow = (entry: AuditEntry) => ({
   action: entry.action,
   actorId: entry.actorId ?? null,
   serverId: entry.serverId ?? null,
   target: entry.target ?? null,
});

const recordAudit = async (entry: AuditEntry): Promise<void> => {
   try {
      await prisma.auditLog.create({
         data: auditRow(entry),
         select: { id: true },
      });
   } catch (err) {
      logger.warn("Could not record audit entry", {
         action: entry.action,
         error: describeError(err),
      });
   }
};

const auditSelect = {
   id: true,
   action: true,
   actorId: true,
   target: true,
   createdAt: true,
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;
type Position = { createdAt: Date; id: string };

const encodeCursor = ({ createdAt, id }: Position): string =>
   Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
      "base64url"
   );

const decodeCursor = (cursor: string): Position => {
   const [timestamp, id] = Buffer.from(cursor, "base64url")
      .toString("utf8")
      .split("|");
   const createdAt = new Date(timestamp ?? "");
   if (!id || Number.isNaN(createdAt.getTime()))
      throw new ApiHttpError(400, "Invalid cursor");
   return { createdAt, id };
};

// keyset pagination over whichever [<scope>, createdAt] index the caller's
// filter selects: rows share a timestamp often enough (one request writes
// several) that the id breaks ties
const before = ({ createdAt, id }: Position): Prisma.AuditLogWhereInput => ({
   OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }],
});

const actorsById = async (
   rows: AuditRow[]
): Promise<Map<string, { email: string; name: string }>> => {
   const ids = [...new Set(rows.flatMap((row) => row.actorId ?? []))];
   if (ids.length === 0) return new Map();
   const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, name: true },
   });
   return new Map(users.map(({ id, email, name }) => [id, { email, name }]));
};

type AuditPageQuery = {
   where: Prisma.AuditLogWhereInput;
   cursor?: string | undefined;
   limit: number;
};

// one page of the audit log, newest first. `where` is what scopes it — a
// server for the members view, an actor for the account's own activity — and
// is the only thing either route decides
const listAuditPage = async ({
   where,
   cursor,
   limit,
}: AuditPageQuery): Promise<AuditLogPage> => {
   const rows = await prisma.auditLog.findMany({
      where: { ...where, ...(cursor ? before(decodeCursor(cursor)) : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: auditSelect,
   });
   const page = rows.slice(0, limit);
   const actors = await actorsById(page);
   const entries: AuditLogEntry[] = page.map((row) => {
      const actor = row.actorId ? actors.get(row.actorId) : undefined;
      return {
         id: row.id,
         action: row.action as AuditAction,
         actorId: row.actorId,
         actorEmail: actor?.email ?? null,
         actorName: actor?.name ?? null,
         target: row.target,
         createdAt: row.createdAt.toISOString(),
      };
   });
   const last = page.at(-1);
   return {
      entries,
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
   };
};

export { auditRow, listAuditPage, recordAudit };
