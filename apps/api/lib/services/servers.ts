import {
   CURSOR_ID_MAX,
   decodeCursorText,
   encodeCursorText,
   invalidCursor,
   pageWith,
} from "@/lib/cursor";
import { ApiHttpError, serverNotFound } from "@/lib/http";
import { detectProvider } from "@/lib/utils/detect-provider";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { tryDecryptCredentials } from "@/lib/s3/stored-credentials";
import { $Enums, Prisma, type Server } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import { Permission, auditAccess, hasPermission } from "@s3-viewer/permissions";
import {
   Provider,
   Role,
   SERVER_NAME_MAX,
   type AuditSettings,
   type ServerCredentials,
   type ServerInfo,
   type ServerPage,
   type StorageCapabilities,
} from "@s3-viewer/shared";
import { z } from "zod";

const auditScopeSelect = {
   auditEnabled: true,
   auditLevel: true,
} satisfies Prisma.ServerSelect;

type AuditScope = Pick<AuditSettings, "enabled" | "level">;

const auditScopeOf = (
   row: Prisma.ServerGetPayload<{ select: typeof auditScopeSelect }>
): AuditScope => ({
   enabled: row.auditEnabled,
   level: row.auditLevel,
});

const auditSettingsSelect = {
   ...auditScopeSelect,
   auditViewRole: true,
   auditManageRole: true,
   auditRetentionDays: true,
} satisfies Prisma.ServerSelect;

type AuditSettingsRow = Prisma.ServerGetPayload<{
   select: typeof auditSettingsSelect;
}>;

const auditSettingsOf = (row: AuditSettingsRow): AuditSettings => ({
   ...auditScopeOf(row),
   viewRole: row.auditViewRole,
   manageRole: row.auditManageRole === "ADMIN" ? Role.ADMIN : Role.OWNER,
   retentionDays: row.auditRetentionDays,
});

const serverInfoSelect = {
   id: true,
   name: true,
   provider: true,
   capabilities: true,
   restrictedBuckets: true,
   ...auditSettingsSelect,
} satisfies Prisma.ServerSelect;

type ServerRow = AuditSettingsRow & {
   id: string;
   name: string;
   provider: $Enums.Provider;
   capabilities: Prisma.JsonValue;
   restrictedBuckets: boolean;
};

const UNREADABLE_CAPABILITIES: StorageCapabilities = {
   writable: false,
   deleteProtection: null,
   notice:
      "Storage credentials could not be read. Ask the owner to update them.",
};

const storedCapabilities = z.object({
   writable: z.boolean(),
   deleteProtection: z.enum(["conditional", "checked"]).nullable(),
   notice: z.string().nullable(),
}) satisfies z.ZodType<StorageCapabilities>;

// capabilities are stored whenever credentials are written, so a row without them is unreadable rather than re-probed.
const capabilitiesOf = (row: ServerRow): StorageCapabilities => {
   const stored = storedCapabilities.safeParse(row.capabilities);
   return stored.success ? stored.data : UNREADABLE_CAPABILITIES;
};

const toServerInfo = (row: ServerRow, userRole: Role): ServerInfo => ({
   id: row.id,
   name: row.name,
   provider: row.provider,
   userRole,
   capabilities: capabilitiesOf(row),
   canCreateBucket:
      hasPermission(userRole, Permission.CREATE_BUCKET) &&
      (!row.restrictedBuckets || userRole === Role.OWNER),
   canRemoveBuckets: row.restrictedBuckets,
   audit: auditAccess(userRole, auditSettingsOf(row)),
});

type ServerAccessRow = ServerRow & { role: $Enums.Role };

const SERVER_INFO_COLUMNS = Prisma.sql`a."role", s."id", s."name", s."provider", s."capabilities",
   s."restrictedBuckets", s."auditEnabled", s."auditLevel", s."auditViewRole",
   s."auditManageRole", s."auditRetentionDays"`;

const getServerInfo = async (
   userId: string,
   serverId: string
): Promise<ServerInfo> => {
   const [row] = await prisma.$queryRaw<ServerAccessRow[]>`
      SELECT ${SERVER_INFO_COLUMNS}
      FROM "server_access" a
      JOIN "server" s ON s."id" = a."serverId"
      WHERE a."userId" = ${userId} AND a."serverId" = ${serverId}`;
   if (!row) throw serverNotFound();
   return toServerInfo(row, row.role);
};

const SERVER_PAGE_SIZE = 100;

type ServerPosition = { name: string; id: string };

const encodeServerCursor = ({ name, id }: ServerPosition): string =>
   encodeCursorText(`${name}|${id}`);

// names may contain "|" but cuids can't, so split on the last one.
const decodeServerCursor = (cursor: string): ServerPosition => {
   const decoded = decodeCursorText(cursor);
   const split = decoded.lastIndexOf("|");
   const id = decoded.slice(split + 1);
   const name = decoded.slice(0, split);
   if (
      split < 0 ||
      !id ||
      id.length > CURSOR_ID_MAX ||
      name.length === 0 ||
      name.length > SERVER_NAME_MAX
   )
      return invalidCursor();
   return { name, id };
};

const serverPageRows = (
   userId: string,
   position: ServerPosition | undefined,
   take: number
): Promise<ServerAccessRow[]> =>
   prisma.$queryRaw<ServerAccessRow[]>`
      SELECT ${SERVER_INFO_COLUMNS}
      FROM "server_access" a
      JOIN "server" s ON s."id" = a."serverId"
      WHERE a."userId" = ${userId} ${
         position
            ? Prisma.sql`AND (s."name", s."id") > (${position.name}, ${position.id})`
            : Prisma.empty
      }
      ORDER BY s."name" ASC, s."id" ASC
      LIMIT ${take}`;

const listServerPage = async (
   userId: string,
   cursor: string | undefined
): Promise<ServerPage> => {
   const rows = await serverPageRows(
      userId,
      cursor ? decodeServerCursor(cursor) : undefined,
      SERVER_PAGE_SIZE + 1
   );
   const { page, nextCursor } = pageWith(
      rows,
      SERVER_PAGE_SIZE,
      encodeServerCursor
   );
   return {
      servers: page.map((row) => toServerInfo(row, row.role)),
      nextCursor,
   };
};

type BucketScopeSettings = {
   restrictedBuckets: boolean;
   allowedBuckets: readonly string[];
};

// row-locks the server for the rest of the transaction so concurrent membership and settings writes serialize on it.
const lockServerRow = async <Column extends keyof Server>(
   tx: Prisma.TransactionClient,
   serverId: string,
   select: readonly Column[]
): Promise<Pick<Server, Column>> => {
   const columns = Prisma.join(
      select.map((column) => Prisma.raw(`"${column}"`)),
      ", "
   );
   const rows = await tx.$queryRaw<Pick<Server, Column>[]>`
      SELECT ${columns}
      FROM "server"
      WHERE "id" = ${serverId}
      FOR UPDATE
   `;
   const row = rows[0];
   if (!row) throw serverNotFound();
   return row;
};

const lockBucketScope = (
   tx: Prisma.TransactionClient,
   serverId: string
): Promise<BucketScopeSettings> =>
   lockServerRow(tx, serverId, ["restrictedBuckets", "allowedBuckets"]);

const lockAuditSettings = async (
   tx: Prisma.TransactionClient,
   serverId: string
): Promise<AuditSettings> =>
   auditSettingsOf(
      await lockServerRow(tx, serverId, [
         "auditEnabled",
         "auditLevel",
         "auditViewRole",
         "auditManageRole",
         "auditRetentionDays",
      ])
   );

const isBucketAllowed = (
   scope: BucketScopeSettings,
   bucketName: string
): boolean =>
   !scope.restrictedBuckets || scope.allowedBuckets.includes(bucketName);

const assertBucketRemovable = (
   scope: BucketScopeSettings,
   bucketName: string
): void => {
   if (!scope.restrictedBuckets) {
      throw new ApiHttpError(
         409,
         "This server reaches every bucket its credentials allow, so buckets can't be removed from it one by one."
      );
   }
   if (!scope.allowedBuckets.includes(bucketName)) {
      throw new ApiHttpError(404, "Bucket not found");
   }
   if (scope.allowedBuckets.length === 1) {
      throw new ApiHttpError(
         409,
         `${bucketName} is the only bucket this server is allowed to reach. Delete the server instead.`
      );
   }
};

const readCredentials = (
   encrypted: string,
   userId: string
): ServerCredentials => {
   const credentials = tryDecryptCredentials(encrypted, userId);
   if (!credentials)
      throw new ApiHttpError(400, "Could not read those credentials");
   return credentials;
};

// the stored credentials this request read were swapped by someone else before its own swap committed.
const credentialsReplaced = (): ApiHttpError =>
   new ApiHttpError(
      409,
      "Server credentials were replaced by another session. Reload and try again."
   );

type OpenedCredentials = { credentials: ServerCredentials; provider: Provider };

// every route that takes credentials from a request opens them here, so none can skip the private-endpoint check
const openCredentials = async (
   encrypted: string,
   userId: string
): Promise<OpenedCredentials> => {
   const credentials = readCredentials(encrypted, userId);
   await assertPublicEndpoint(credentials.endpoint);
   return { credentials, provider: detectProvider(credentials.endpoint) };
};

export {
   SERVER_PAGE_SIZE,
   assertBucketRemovable,
   auditScopeOf,
   auditScopeSelect,
   auditSettingsOf,
   auditSettingsSelect,
   credentialsReplaced,
   getServerInfo,
   isBucketAllowed,
   listServerPage,
   lockAuditSettings,
   lockBucketScope,
   lockServerRow,
   openCredentials,
   serverInfoSelect,
   toServerInfo,
};
export type { AuditScope, BucketScopeSettings };
