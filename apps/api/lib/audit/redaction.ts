import { logger } from "@/lib/logger";
import { prisma } from "@s3-viewer/db";
import {
   AUDIT_ACTIONS,
   Role,
   type AuditAction,
   type AuditDetail,
   type AuditLogEntry,
} from "@s3-viewer/shared";
import type { AuditFilters, AuditRow } from "./query";

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

// what a reader may see of each row: unreadable details dropped, and ends and grants beyond their reach stripped.
const readableEntries = async (
   rows: readonly AuditRow[],
   filters: AuditFilters
): Promise<AuditLogEntry[]> => {
   const entries = rows.map(toEntry);
   const foreign = await reachableForeignEnds(entries, filters);
   return entries.map((entry) =>
      withReachableGrants(withReachableEnds(entry, filters, foreign), filters)
   );
};

export { readableEntries };
