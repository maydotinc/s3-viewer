import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { MINUTE_MS, Provider } from "@s3-viewer/types";
import { ApiHttpError } from "../http";
import { assertPublicEndpoint } from "../utils/endpoint";
import { clientProvider } from "./provider";
import { budgetServerOf, withRequestBudget } from "./request-budget";

const REGION_TTL_MS = 10 * MINUTE_MS;
const MAX_BUCKET_CLIENTS = 500;
const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d+$/;

type BucketClient = {
   client: S3Client;
   expiresAt: number;
   bucket: string;
   owner: Map<string, BucketClient>;
   reference?: WeakRef<BucketClient>;
};
// Each credential-cache generation owns its own regional clients. A credential
// rotation can never reuse clients carrying the old credentials.
const bucketsByClient = new WeakMap<S3Client, Map<string, BucketClient>>();
const invalidatedClients = new WeakSet<S3Client>();
// Bound all regional clients together, rather than allowing 500 for each of
// the 500 credential-cache entries.
// Weak references enforce the shared size bound without retaining credentials
// from transient connection probes after their base client is released.
const regionalClients = new Set<WeakRef<BucketClient>>();

const evict = (entry: BucketClient): void => {
   if (entry.owner.get(entry.bucket) === entry)
      entry.owner.delete(entry.bucket);
   if (entry.reference) regionalClients.delete(entry.reference);
};

class BucketClientInvalidatedError extends ApiHttpError {
   constructor() {
      super(409, "Server credentials changed while connecting. Try again.");
   }
}

const invalidateBucketClients = (client: S3Client): void => {
   invalidatedClients.add(client);
   const buckets = bucketsByClient.get(client);
   if (buckets) {
      for (const entry of buckets.values()) evict(entry);
      bucketsByClient.delete(client);
   }
   // Regional and base clients share one transport. Destroying either client
   // would also close sockets used by other accounts.
};

const getBucketClient = async (
   client: S3Client,
   bucket: string,
   signal?: AbortSignal
): Promise<S3Client> => {
   const provider = await clientProvider(client);
   if (invalidatedClients.has(client)) throw new BucketClientInvalidatedError();
   if (provider !== Provider.S3) return client;

   let buckets = bucketsByClient.get(client);
   if (!buckets) {
      buckets = new Map();
      bucketsByClient.set(client, buckets);
   }
   const hit = buckets.get(bucket);
   if (hit && hit.expiresAt > Date.now()) return hit.client;
   if (hit) evict(hit);

   // HeadBucket returns the region even when ListBucket is denied. Discover
   // before any object operation or signing: presigning never makes a request,
   // and redirect middleware must not replay a destructive operation.
   let region: string | undefined;
   try {
      const out = await client.send(new HeadBucketCommand({ Bucket: bucket }), {
         abortSignal: signal,
      });
      region = out.BucketRegion;
   } catch (error) {
      const response = (
         error as {
            $response?: {
               statusCode?: number;
               headers?: Record<string, string>;
            };
         }
      )?.$response;
      if (![301, 400, 403].includes(response?.statusCode ?? 0)) throw error;
      region = response?.headers?.["x-amz-bucket-region"];
      if (!region) throw error;
   }
   if (!region || region.length > 63 || !REGION.test(region)) {
      throw new ApiHttpError(
         502,
         "Storage did not return a valid bucket region"
      );
   }

   const configuredEndpoint = await client.config.endpoint!();
   const china = configuredEndpoint.hostname.endsWith(".amazonaws.com.cn");
   if (china !== region.startsWith("cn-")) {
      throw new ApiHttpError(
         502,
         "Storage returned a region in another AWS partition"
      );
   }
   const fips = configuredEndpoint.hostname.startsWith("s3-fips")
      ? "-fips"
      : "";
   const dualstack = configuredEndpoint.hostname.includes(".dualstack.")
      ? ".dualstack"
      : "";
   const hostname = `s3${fips}${dualstack}.${region}.amazonaws.com${china ? ".cn" : ""}`;
   // Keep the shared HTTP handler (including public-only DNS lookup/socket caps),
   // session token and retry policy. Only the endpoint and signing region change.
   const endpoint = {
      ...configuredEndpoint,
      hostname,
   };
   await assertPublicEndpoint(
      `${endpoint.protocol}//${hostname}${endpoint.port ? `:${endpoint.port}` : ""}`
   );
   // Invalidation can happen while HeadBucket or DNS is awaiting I/O. Never
   // repopulate either cache with credentials that have since been removed.
   if (invalidatedClients.has(client)) throw new BucketClientInvalidatedError();
   const regional = new S3Client({
      ...client.config,
      endpoint,
      region,
      followRegionRedirects: false,
      retryStrategy: undefined,
      serviceConfiguredEndpoint: undefined,
   });
   // a fresh client means a fresh middleware stack: the regional client would
   // otherwise spend the server's upstream budget without counting against it
   const serverId = budgetServerOf(client);
   if (serverId) withRequestBudget(regional, serverId);
   for (const reference of regionalClients) {
      const entry = reference.deref();
      if (!entry) regionalClients.delete(reference);
      else if (entry.expiresAt <= Date.now()) evict(entry);
   }
   const previous = buckets.get(bucket);
   if (previous) evict(previous);
   while (regionalClients.size >= MAX_BUCKET_CLIENTS) {
      const reference = regionalClients.values().next().value!;
      const entry = reference.deref();
      if (entry) evict(entry);
      else regionalClients.delete(reference);
   }
   const entry: BucketClient = {
      client: regional,
      expiresAt: Date.now() + REGION_TTL_MS,
      bucket,
      owner: buckets,
   };
   entry.reference = new WeakRef(entry);
   buckets.set(bucket, entry);
   regionalClients.add(entry.reference);
   return regional;
};

export {
   BucketClientInvalidatedError,
   getBucketClient,
   invalidateBucketClients,
};
