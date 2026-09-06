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
import {
   BucketClientInvalidatedError,
   getBucketClient,
   invalidateBucketClients,
} from "./bucket-client";

const CACHE_TTL_MS = 10 * MINUTE_MS;
const CACHE_MAX_ENTRIES = 500;
const MAX_CREDENTIAL_READ_ATTEMPTS = 3;
const CONNECTION_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const AGENT_MAX_SOCKETS = 50;
const AGENT_MAX_TOTAL_SOCKETS = 500;
const AGENT_MAX_FREE_SOCKETS = 64;
const AGENT_IDLE_TIMEOUT_MS = 60_000;

type CredentialSnapshot = {
   credentials: string;
   provider: keyof typeof Provider;
};
type CacheEntry = {
   client: S3Client;
   expiresAt: number;
   snapshot: CredentialSnapshot;
};
const cache = new Map<string, CacheEntry>();
const generations = new Map<string, number>();
const inFlightFills = new Map<string, number>();

const removeCachedClient = (serverId: string): void => {
   const entry = cache.get(serverId);
   if (entry) invalidateBucketClients(entry.client);
   cache.delete(serverId);
};

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
         ...(credentials.sessionToken && {
            sessionToken: credentials.sessionToken,
         }),
      },
      forcePathStyle: provider !== Provider.S3,
      followRegionRedirects: false,
      maxAttempts: MAX_ATTEMPTS,
      requestChecksumCalculation:
         provider === Provider.R2 ? "WHEN_REQUIRED" : "WHEN_SUPPORTED",
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
      if (entry.expiresAt <= now) removeCachedClient(key);
   }
   for (const key of cache.keys()) {
      if (cache.size < CACHE_MAX_ENTRIES) break;
      removeCachedClient(key);
   }
};

const readCredentialSnapshot = async (serverId: string) => {
   const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: { credentials: true, provider: true },
   });
   if (!server) {
      removeCachedClient(serverId);
      throw new ApiHttpError(404, SERVER_NOT_FOUND);
   }
   return server;
};

const sameCredentials = (
   left: CredentialSnapshot,
   right: CredentialSnapshot
): boolean =>
   left.credentials === right.credentials && left.provider === right.provider;

const getCachedClient = async (serverId: string): Promise<S3Client> => {
   for (let attempt = 0; attempt < MAX_CREDENTIAL_READ_ATTEMPTS; attempt++) {
      const generation = generationOf(serverId);
      beginFill(serverId);
      try {
         const snapshot = await readCredentialSnapshot(serverId);
         if (generationOf(serverId) !== generation) continue;
         const hit = cache.get(serverId);
         if (
            hit &&
            hit.expiresAt > Date.now() &&
            sameCredentials(hit.snapshot, snapshot)
         ) {
            return hit.client;
         }
         removeCachedClient(serverId);
         const credentials = readStoredCredentials(
            serverId,
            snapshot.credentials
         );
         await assertPublicEndpoint(credentials.endpoint);
         const current = await readCredentialSnapshot(serverId);
         if (
            generationOf(serverId) !== generation ||
            !sameCredentials(snapshot, current)
         ) {
            continue;
         }
         const client = buildClient(credentials, Provider[snapshot.provider]);
         makeRoom();
         removeCachedClient(serverId);
         cache.set(serverId, {
            client,
            expiresAt: Date.now() + CACHE_TTL_MS,
            snapshot,
         });
         return client;
      } finally {
         endFill(serverId);
      }
   }
   throw new ApiHttpError(
      409,
      "Server credentials changed while connecting. Try again."
   );
};

const getS3Client = async (
   serverId: string,
   bucket?: string,
   signal?: AbortSignal
): Promise<S3Client> => {
   for (let attempt = 0; attempt < MAX_CREDENTIAL_READ_ATTEMPTS; attempt++) {
      const client = await getCachedClient(serverId);
      if (bucket === undefined) return client;
      let regional: S3Client;
      try {
         regional = await getBucketClient(client, bucket, signal);
      } catch (error) {
         if (error instanceof BucketClientInvalidatedError) continue;
         throw error;
      }
      // Region discovery and DNS validation await external I/O. Re-read the
      // credential authority before returning a client for the actual action.
      if ((await getCachedClient(serverId)) === client) return regional;
   }
   throw new ApiHttpError(
      409,
      "Server credentials changed while connecting. Try again."
   );
};

const invalidateS3Client = (serverId: string): void => {
   removeCachedClient(serverId);
   if (inFlightFills.has(serverId)) {
      generations.set(serverId, generationOf(serverId) + 1);
   } else {
      generations.delete(serverId);
   }
};

export { getS3Client, getS3ClientFromCredentials, invalidateS3Client };
