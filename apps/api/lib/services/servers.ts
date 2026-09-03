import { SERVER_NOT_FOUND } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { decryptCredentials } from "@/lib/utils/encryption";
import { $Enums, Prisma } from "@prisma/client";
import { prisma } from "@s3-viewer/db";
import {
   Provider,
   Role,
   type ServerCredentials,
   type ServerInfo,
} from "@s3-viewer/types";

const serverInfoSelect = {
   id: true,
   name: true,
   provider: true,
} satisfies Prisma.ServerSelect;

type ServerRow = { id: string; name: string; provider: $Enums.Provider };

const toServerInfo = (row: ServerRow, userRole: Role): ServerInfo => ({
   id: row.id,
   name: row.name,
   provider: Provider[row.provider],
   userRole,
});

const loadServerSettings = async (serverId: string) => {
   const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { allowedBuckets: true, provider: true },
   });
   if (!server) throw new ApiHttpError(404, SERVER_NOT_FOUND);
   return server;
};

const isBucketAllowed = (
   allowedBuckets: readonly string[],
   bucketName: string
): boolean =>
   allowedBuckets.length === 0 || allowedBuckets.includes(bucketName);

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
   isBucketAllowed,
   isMissingRow,
   isUniqueViolation,
   loadServerSettings,
   readCredentials,
   serverInfoSelect,
   toServerInfo,
};
