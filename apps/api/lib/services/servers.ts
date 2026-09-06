import { SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { decryptCredentials } from "@/lib/utils/encryption";
import { storageCapabilities } from "./storage-capabilities";
import { $Enums, Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   MAX_SERVERS_PER_USER,
   Provider,
   Role,
   type ServerCredentials,
   type ServerInfo,
} from "@s3-viewer/types";

const serverInfoSelect = {
   id: true,
   name: true,
   provider: true,
   credentials: true,
} satisfies Prisma.ServerSelect;

type ServerRow = {
   id: string;
   name: string;
   provider: $Enums.Provider;
   credentials: string;
};

const toServerInfo = (row: ServerRow, userRole: Role): ServerInfo => {
   const provider = Provider[row.provider];
   let capabilities;
   try {
      // B2 remains Other in the database. Only derive public feature flags;
      // neither the endpoint nor its encrypted credentials leave this helper.
      capabilities = storageCapabilities(
         provider,
         provider === Provider.Other
            ? decryptCredentials(row.credentials).endpoint
            : undefined
      );
   } catch {
      capabilities = {
         upload: false,
         replace: false,
         rename: false,
         delete: false,
         notice:
            "Storage credentials could not be read. Ask the owner to update them.",
      };
   }
   return { id: row.id, name: row.name, provider, userRole, capabilities };
};

type BucketScopeSettings = {
   restrictedBuckets: boolean;
   allowedBuckets: readonly string[];
};

const loadServerSettings = async (serverId: string) => {
   const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { allowedBuckets: true, restrictedBuckets: true, provider: true },
   });
   if (!server) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   return server;
};

const lockBucketScope = async (
   tx: Prisma.TransactionClient,
   serverId: string
): Promise<BucketScopeSettings> => {
   const rows = await tx.$queryRaw<BucketScopeSettings[]>`
      SELECT "restrictedBuckets", "allowedBuckets"
      FROM "server"
      WHERE "id" = ${serverId}
      FOR UPDATE
   `;
   const scope = rows[0];
   if (!scope) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   return scope;
};

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

const exceedsServerCap = (existingTotal: number): boolean =>
   existingTotal >= MAX_SERVERS_PER_USER;

const isPrismaError = (err: unknown, code: string): boolean =>
   err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

const isUniqueViolation = (err: unknown): boolean =>
   isPrismaError(err, "P2002");

const isMissingRow = (err: unknown): boolean => isPrismaError(err, "P2025");

const readCredentials = (encrypted: string): ServerCredentials => {
   try {
      return decryptCredentials(encrypted);
   } catch {
      throw new ApiHttpError(400, "Could not read those credentials");
   }
};

export {
   assertBucketRemovable,
   exceedsServerCap,
   isBucketAllowed,
   isMissingRow,
   isUniqueViolation,
   loadServerSettings,
   lockBucketScope,
   readCredentials,
   serverInfoSelect,
   toServerInfo,
};
export type { BucketScopeSettings };
