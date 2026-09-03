import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { MINUTE_MS, Provider, type ServerCredentials } from "@s3-viewer/types";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { SERVER_NOT_FOUND } from "../constants";
import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { decryptCredentials } from "../utils/encryption";
import { credentialsUnreadableError } from "./errors";

const CACHE_TTL_MS = 10 * MINUTE_MS;
const CACHE_MAX_ENTRIES = 500;
const CONNECTION_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

type CacheEntry = { client: S3Client; expiresAt: number };
const cache = new Map<string, CacheEntry>();
/** Bumped on invalidate so a fill that started before it never re-caches stale credentials. */
const generations = new Map<string, number>();

const generationOf = (serverId: string): number =>
   generations.get(serverId) ?? 0;

const httpAgent = new HttpAgent({ keepAlive: true });
const httpsAgent = new HttpsAgent({ keepAlive: true });

const buildClient = (
   credentials: ServerCredentials,
   provider: Provider
): S3Client =>
   new S3Client({
      region: credentials.region,
      endpoint: credentials.endpoint,
      credentials: {
         accessKeyId: credentials.accessKey,
         secretAccessKey: credentials.secretKey,
      },
      forcePathStyle: provider !== Provider.S3,
      maxAttempts: MAX_ATTEMPTS,
      requestHandler: {
         connectionTimeout: CONNECTION_TIMEOUT_MS,
         requestTimeout: REQUEST_TIMEOUT_MS,
         httpAgent,
         httpsAgent,
      },
   });

const getS3ClientFromCredentials = (
   credentials: ServerCredentials,
   provider: Provider = Provider.Other
): S3Client => buildClient(credentials, provider);

const readStoredCredentials = (
   serverId: string,
   blob: string
): ServerCredentials => {
   try {
      return decryptCredentials(blob);
   } catch {
      logger.warn("Could not decrypt server credentials", { serverId });
      throw credentialsUnreadableError();
   }
};

const makeRoom = (): void => {
   if (cache.size < CACHE_MAX_ENTRIES) return;
   const now = Date.now();
   for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
   }
   for (const key of cache.keys()) {
      if (cache.size < CACHE_MAX_ENTRIES) break;
      cache.delete(key);
   }
};

const getS3Client = async (serverId: string): Promise<S3Client> => {
   const hit = cache.get(serverId);
   if (hit && hit.expiresAt > Date.now()) return hit.client;

   const generation = generationOf(serverId);
   const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { credentials: true, provider: true },
   });
   if (!server) throw new ApiHttpError(404, SERVER_NOT_FOUND);

   const client = buildClient(
      readStoredCredentials(serverId, server.credentials),
      Provider[server.provider]
   );
   if (generationOf(serverId) === generation) {
      makeRoom();
      cache.set(serverId, { client, expiresAt: Date.now() + CACHE_TTL_MS });
   }
   return client;
};

const invalidateS3Client = (serverId: string): void => {
   cache.delete(serverId);
   generations.set(serverId, generationOf(serverId) + 1);
};

export { getS3Client, getS3ClientFromCredentials, invalidateS3Client };
