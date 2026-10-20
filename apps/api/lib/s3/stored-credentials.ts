import { logger } from "@/lib/logger";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { decryptCredentials } from "@/lib/utils/encryption";
import type { ServerCredentials } from "@s3-viewer/types";
import { credentialsUnreadableError } from "./errors";

// a blob sealed to another key or owner looks the same as a corrupt one, so callers only learn that it did not open.
const tryDecryptCredentials = (
   blob: string,
   boundTo: string
): ServerCredentials | null => {
   try {
      return decryptCredentials(blob, boundTo);
   } catch {
      return null;
   }
};

const readStoredCredentials = (
   serverId: string,
   blob: string,
   ownerId: string
): ServerCredentials => {
   const credentials = tryDecryptCredentials(blob, ownerId);
   if (credentials) return credentials;
   logger.warn("Could not decrypt server credentials", { serverId });
   throw credentialsUnreadableError();
};

// every stored credential a request acts on is opened here, so no route can reach a private endpoint through one.
const openStoredCredentials = async (
   serverId: string,
   blob: string,
   ownerId: string
): Promise<ServerCredentials> => {
   const credentials = readStoredCredentials(serverId, blob, ownerId);
   await assertPublicEndpoint(credentials.endpoint);
   return credentials;
};

export { openStoredCredentials, tryDecryptCredentials };
