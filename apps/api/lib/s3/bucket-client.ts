import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3";
import { MINUTE_MS, Provider, SECOND_MS } from "@s3-viewer/types";
import { ApiHttpError } from "@/lib/http";
import { assertPublicEndpoint } from "@/lib/utils/endpoint";
import { waitForSharedOperation } from "@/lib/utils/abort";
import { clientProvider } from "./provider";
import { CREDENTIALS_CHANGED_MESSAGE } from "./errors";
import { bucketRegionHeader, failedResponse } from "./failure";
import { cloneS3Client } from "./clone-client";

const REGION_TTL_MS = 10 * MINUTE_MS;
const DISCOVERY_TIMEOUT_MS = 15 * SECOND_MS;
const MAX_BUCKET_CLIENTS = 500;
const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d+$/;

type BucketClient = {
   client: S3Client;
   expiresAt: number;
   bucket: string;
   owner: Map<string, BucketClient>;
   reference?: WeakRef<BucketClient>;
};
const bucketsByClient = new WeakMap<S3Client, Map<string, BucketClient>>();
const discoveries = new WeakMap<S3Client, Map<string, Promise<S3Client>>>();
const invalidatedClients = new WeakSet<S3Client>();
const regionalClients = new Set<WeakRef<BucketClient>>();

const evict = (entry: BucketClient): void => {
   if (entry.owner.get(entry.bucket) === entry)
      entry.owner.delete(entry.bucket);
   if (entry.reference) regionalClients.delete(entry.reference);
};

class BucketClientInvalidatedError extends ApiHttpError {
   constructor() {
      super(409, CREDENTIALS_CHANGED_MESSAGE);
   }
}

const invalidateBucketClients = (client: S3Client): void => {
   invalidatedClients.add(client);
   discoveries.delete(client);
   const buckets = bucketsByClient.get(client);
   if (buckets) {
      for (const entry of buckets.values()) evict(entry);
      bucketsByClient.delete(client);
   }
   // not destroyed: regional and base clients share one transport with other accounts.
};

type ResolvedBucketClient = { client: S3Client; discovered: boolean };

const mapFor = <V>(
   store: WeakMap<S3Client, Map<string, V>>,
   client: S3Client
): Map<string, V> => {
   const existing = store.get(client);
   if (existing) return existing;
   const created = new Map<string, V>();
   store.set(client, created);
   return created;
};

const discoverBucketClient = async (
   client: S3Client,
   bucket: string,
   buckets: Map<string, BucketClient>
): Promise<S3Client> => {
   // HEAD finds the region without ListBucket; all waiters share it, so it has its own deadline.
   let region: string | undefined;
   try {
      const out = await client.send(new HeadBucketCommand({ Bucket: bucket }), {
         abortSignal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      });
      region = out.BucketRegion;
   } catch (error) {
      const status = failedResponse(error)?.statusCode ?? 0;
      if (![301, 400, 403].includes(status)) throw error;
      region = bucketRegionHeader(error);
      if (!region) throw error;
   }
   if (!region || region.length > 63 || !REGION.test(region)) {
      throw new ApiHttpError(
         502,
         "Storage did not return a valid bucket region"
      );
   }

   const configuredEndpoint = await client.config.endpoint?.();
   if (!configuredEndpoint) {
      throw new ApiHttpError(502, "Storage has no configured endpoint");
   }
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
   const endpoint = {
      ...configuredEndpoint,
      hostname,
   };
   await assertPublicEndpoint(
      `${endpoint.protocol}//${hostname}${endpoint.port ? `:${endpoint.port}` : ""}`
   );
   if (invalidatedClients.has(client)) throw new BucketClientInvalidatedError();
   const regional = cloneS3Client(client, {
      endpoint,
      region,
   });
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

const resolveBucketClient = async (
   client: S3Client,
   bucket: string,
   signal?: AbortSignal
): Promise<ResolvedBucketClient> => {
   signal?.throwIfAborted();
   const provider = await clientProvider(client);
   signal?.throwIfAborted();
   if (invalidatedClients.has(client)) throw new BucketClientInvalidatedError();
   if (provider !== Provider.S3) return { client, discovered: false };

   const buckets = mapFor(bucketsByClient, client);
   const hit = buckets.get(bucket);
   if (hit && hit.expiresAt > Date.now()) {
      return { client: hit.client, discovered: false };
   }
   if (hit) evict(hit);

   signal?.throwIfAborted();
   const pending = mapFor(discoveries, client);
   let discovery = pending.get(bucket);
   if (!discovery) {
      discovery = discoverBucketClient(client, bucket, buckets).finally(() => {
         if (pending.get(bucket) === discovery) pending.delete(bucket);
      });
      pending.set(bucket, discovery);
   }
   return {
      client: await waitForSharedOperation(discovery, signal),
      discovered: true,
   };
};

const getBucketClient = async (
   client: S3Client,
   bucket: string,
   signal?: AbortSignal
): Promise<S3Client> =>
   (await resolveBucketClient(client, bucket, signal)).client;

export {
   BucketClientInvalidatedError,
   getBucketClient,
   invalidateBucketClients,
   resolveBucketClient,
};
