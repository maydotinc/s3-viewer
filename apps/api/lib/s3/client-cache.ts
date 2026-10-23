import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import {
   MINUTE_MS,
   Provider,
   type ServerCredentials,
   SECOND_MS,
} from "@s3-viewer/types";
import { createHash } from "node:crypto";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { env } from "@/lib/env";
import { ApiHttpError, serverNotFound } from "@/lib/http";
import { waitForSharedOperation } from "@/lib/utils/abort";
import { bump } from "@/lib/utils/counter-map";
import { publicOnlyLookup } from "@/lib/utils/endpoint";
import { CREDENTIALS_CHANGED_MESSAGE, toBucketHttpError } from "./errors";
import { withFolderGuard } from "./folder-guard";
import { withRequestBudget } from "./request-budget";
import { cappedStreamCollector } from "./response-collector";
import { openStoredCredentials } from "./stored-credentials";
import {
   BucketClientInvalidatedError,
   invalidateBucketClients,
   resolveBucketClient,
} from "./bucket-client";

const CACHE_TTL_MS = 10 * MINUTE_MS;
const CACHE_MAX_ENTRIES = 500;
const MAX_CREDENTIAL_READ_ATTEMPTS = 3;
const CONNECTION_TIMEOUT_MS = 5000;
const SOCKET_QUEUE_WARNING_MS = 35 * SECOND_MS;
const MAX_ATTEMPTS = 2;
const AGENT_MAX_FREE_SOCKETS = 16;
const AGENT_IDLE_TIMEOUT_MS = MINUTE_MS;

type CredentialSnapshot = {
   credentials: string;
   provider: keyof typeof Provider;
   ownerId: string;
};
type ClientScope = { serverId: string; credentials?: CredentialSnapshot };
type Agents = { httpAgent: HttpAgent; httpsAgent: HttpsAgent };
type CacheEntry = {
   client: S3Client;
   agents: Agents;
   expiresAt: number;
   snapshot: CredentialSnapshot;
};
const cache = new Map<string, CacheEntry>();
const generations = new Map<string, number>();
const inFlightFills = new Map<string, number>();
const fills = new Map<string, Promise<S3Client>>();

// requests still running on a removed client (a long download or copy) keep their sockets until they
// finish; only the idle ones close now, and nothing returns to the pool afterwards.
const retireAgents = (agents: Agents): void => {
   for (const agent of [agents.httpAgent, agents.httpsAgent]) {
      agent.maxFreeSockets = 0;
      for (const sockets of Object.values(agent.freeSockets))
         for (const socket of sockets ?? []) socket.destroy();
   }
};

const removeCachedClient = (serverId: string): void => {
   const entry = cache.get(serverId);
   if (!entry) return;
   invalidateBucketClients(entry.client);
   retireAgents(entry.agents);
   cache.delete(serverId);
};

const generationOf = (serverId: string): number =>
   generations.get(serverId) ?? 0;

const beginFill = (serverId: string): void => {
   bump(inFlightFills, serverId, 1);
};

const endFill = (serverId: string): void => {
   if (bump(inFlightFills, serverId, -1) === 0) generations.delete(serverId);
};

const agentOptions = {
   keepAlive: true,
   lookup: publicOnlyLookup,
   maxSockets: env.S3_MAX_SOCKETS_PER_HOST,
   maxTotalSockets: env.S3_MAX_TOTAL_SOCKETS,
   maxFreeSockets: AGENT_MAX_FREE_SOCKETS,
   timeout: AGENT_IDLE_TIMEOUT_MS,
};

const createAgents = (): Agents => ({
   httpAgent: new HttpAgent(agentOptions),
   httpsAgent: new HttpsAgent(agentOptions),
});

// one-off probe clients share a pair; each cached server gets its own so tenants behind one
// path-style host do not queue for the same per-host sockets.
const probeAgents = createAgents();

const buildClient = (
   credentials: ServerCredentials,
   provider: Provider,
   { httpAgent, httpsAgent }: Agents
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
      streamCollector: cappedStreamCollector,
      requestHandler: {
         connectionTimeout: CONNECTION_TIMEOUT_MS,
         // bounds the wait for a response head only. an idle socket timeout would also kill the zip's
         // deliberately paused prefetch bodies, so open bodies rely on the read budget and progress floors.
         requestTimeout: env.S3_REQUEST_TIMEOUT_MS,
         throwOnRequestTimeout: true,
         socketAcquisitionWarningTimeout: SOCKET_QUEUE_WARNING_MS,
         httpAgent,
         httpsAgent,
      },
   });

const credentialBudgetKey = (credentials: ServerCredentials): string =>
   `credentials:${createHash("sha256")
      .update(credentials.endpoint)
      .update("\0")
      .update(credentials.accessKey)
      .digest("base64url")}`;

const clientWithAgents = (
   credentials: ServerCredentials,
   provider: Provider,
   serverId: string | undefined,
   agents: Agents
): S3Client => {
   const client = withRequestBudget(
      buildClient(credentials, provider, agents),
      serverId ?? credentialBudgetKey(credentials)
   );
   return serverId ? withFolderGuard(client, serverId) : client;
};

const getS3ClientFromCredentials = (
   credentials: ServerCredentials,
   provider: Provider = Provider.Other,
   serverId?: string
): S3Client => clientWithAgents(credentials, provider, serverId, probeAgents);

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
      select: { credentials: true, provider: true, ownerId: true },
   });
   if (!server) {
      removeCachedClient(serverId);
      throw serverNotFound();
   }
   return server;
};

const sameCredentials = (
   left: CredentialSnapshot,
   right: CredentialSnapshot
): boolean =>
   left.credentials === right.credentials && left.provider === right.provider;

const fillCachedClient = async (
   serverId: string,
   known?: CredentialSnapshot
): Promise<S3Client> => {
   for (let attempt = 0; attempt < MAX_CREDENTIAL_READ_ATTEMPTS; attempt++) {
      const generation = generationOf(serverId);
      beginFill(serverId);
      try {
         const snapshot =
            attempt === 0 && known
               ? known
               : await readCredentialSnapshot(serverId);
         if (generationOf(serverId) !== generation) continue;
         const hit = cache.get(serverId);
         if (
            hit &&
            hit.expiresAt > Date.now() &&
            sameCredentials(hit.snapshot, snapshot)
         ) {
            // re-inserting moves the hit to the back of makeRoom's eviction order.
            cache.delete(serverId);
            cache.set(serverId, hit);
            return hit.client;
         }
         removeCachedClient(serverId);
         const credentials = await openStoredCredentials(
            serverId,
            snapshot.credentials,
            snapshot.ownerId
         );
         const current = await readCredentialSnapshot(serverId);
         if (
            generationOf(serverId) !== generation ||
            !sameCredentials(snapshot, current)
         ) {
            continue;
         }
         const agents = createAgents();
         const client = clientWithAgents(
            credentials,
            Provider[snapshot.provider],
            serverId,
            agents
         );
         makeRoom();
         removeCachedClient(serverId);
         cache.set(serverId, {
            client,
            agents,
            expiresAt: Date.now() + CACHE_TTL_MS,
            snapshot,
         });
         return client;
      } finally {
         endFill(serverId);
      }
   }
   throw new ApiHttpError(409, CREDENTIALS_CHANGED_MESSAGE);
};

const getCachedClient = (
   serverId: string,
   known?: CredentialSnapshot
): Promise<S3Client> => {
   const inFlight = fills.get(serverId);
   if (inFlight) return inFlight;
   const fill = fillCachedClient(serverId, known).finally(() => {
      if (fills.get(serverId) === fill) fills.delete(serverId);
   });
   fills.set(serverId, fill);
   return fill;
};

const getS3Client = async (
   { serverId, credentials }: ClientScope,
   bucket?: string,
   signal?: AbortSignal
): Promise<S3Client> => {
   for (let attempt = 0; attempt < MAX_CREDENTIAL_READ_ATTEMPTS; attempt++) {
      signal?.throwIfAborted();
      const client = await waitForSharedOperation(
         getCachedClient(serverId, credentials),
         signal
      );
      if (bucket === undefined) return client;
      let regional: S3Client;
      let discovered: boolean;
      try {
         ({ client: regional, discovered } = await resolveBucketClient(
            client,
            bucket,
            signal
         ));
      } catch (error) {
         if (error instanceof BucketClientInvalidatedError) continue;
         throw toBucketHttpError(error);
      }
      signal?.throwIfAborted();
      if (!discovered) return regional;
      if (
         (await waitForSharedOperation(getCachedClient(serverId), signal)) ===
         client
      )
         return regional;
   }
   throw new ApiHttpError(409, CREDENTIALS_CHANGED_MESSAGE);
};

// new callers must not join an invalidated fill whose authority retries may already be spent.
const invalidateS3Client = (serverId: string): void => {
   removeCachedClient(serverId);
   fills.delete(serverId);
   if (inFlightFills.has(serverId)) {
      generations.set(serverId, generationOf(serverId) + 1);
   } else {
      generations.delete(serverId);
   }
};

export { getS3Client, getS3ClientFromCredentials, invalidateS3Client };
export type { CredentialSnapshot };
