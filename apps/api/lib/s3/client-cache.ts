import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { MINUTE_MS, Provider, type ServerCredentials } from "@s3-viewer/types";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { SERVER_NOT_FOUND } from "../constants";
import { ApiHttpError } from "../http";
import { logger } from "../logger";
import { assertPublicEndpoint, publicOnlyLookup } from "../utils/endpoint";
import { decryptCredentials } from "../utils/encryption";
import { credentialsUnreadableError } from "./errors";

const CACHE_TTL_MS = 10 * MINUTE_MS;
const CACHE_MAX_ENTRIES = 500;
const CONNECTION_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const AGENT_MAX_SOCKETS = 50;
const AGENT_MAX_TOTAL_SOCKETS = 500;
const AGENT_MAX_FREE_SOCKETS = 64;
const AGENT_IDLE_TIMEOUT_MS = 60_000;

type CacheEntry = { client: S3Client; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const generations = new Map<string, number>();
const inFlightFills = new Map<string, number>();

const generationOf = (serverId: string): number =>
   generations.get(serverId) ?? 0;

const beginFill = (serverId: string): void => {
   inFlightFills.set(serverId, (inFlightFills.get(serverId) ?? 0) + 1);
};

const endFill = (serverId: string): void => {
   const remaining = (inFlightFills.get(serverId) ?? 1) - 1;
   if (remaining > 0) {
      inFlightFills.set(serverId, remaining);
      return;
   }
   inFlightFills.delete(serverId);
   generations.delete(serverId);
};

// passing an agent makes the sdk keep it verbatim, so its socket caps are ours
// to set
const agentOptions = {
   keepAlive: true,
   lookup: publicOnlyLookup,
   maxSockets: AGENT_MAX_SOCKETS,
   maxTotalSockets: AGENT_MAX_TOTAL_SOCKETS,
   maxFreeSockets: AGENT_MAX_FREE_SOCKETS,
   timeout: AGENT_IDLE_TIMEOUT_MS,
};

const httpAgent = new HttpAgent(agentOptions);
const httpsAgent = new HttpsAgent(agentOptions);

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
   // a cached client's endpoint was re-checked when the entry was filled, so a
   // hit does not repeat the dns lookup until the entry expires
   const hit = cache.get(serverId);
   if (hit && hit.expiresAt > Date.now()) return hit.client;

   const generation = generationOf(serverId);
   beginFill(serverId);
   try {
      const server = await prisma.server.findUnique({
         where: { id: serverId },
         select: { credentials: true, provider: true },
      });
      if (!server) throw new ApiHttpError(404, SERVER_NOT_FOUND);

      const credentials = readStoredCredentials(serverId, server.credentials);
      await assertPublicEndpoint(credentials.endpoint);
      const client = buildClient(credentials, Provider[server.provider]);
      if (generationOf(serverId) === generation) {
         makeRoom();
         cache.set(serverId, { client, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return client;
   } finally {
      endFill(serverId);
   }
};

const invalidateS3Client = (serverId: string): void => {
   cache.delete(serverId);
   if (inFlightFills.has(serverId)) {
      generations.set(serverId, generationOf(serverId) + 1);
   } else {
      generations.delete(serverId);
   }
};

export { getS3Client, getS3ClientFromCredentials, invalidateS3Client };
