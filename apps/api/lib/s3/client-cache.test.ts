import { Provider } from "@s3-viewer/shared";
import { S3Client } from "@aws-sdk/client-s3";
import type { Agent as HttpAgent } from "node:http";
import type { Agent as HttpsAgent } from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
   getS3Client,
   getS3ClientFromCredentials,
   invalidateS3Client,
} from "./client-cache";
import { env } from "@/lib/env";
import { getBucketClient } from "./bucket-client";
import { budgetServerOf } from "./request-budget";

const state = vi.hoisted(() => ({
   snapshot: {
      credentials: "old",
      provider: "Other",
      ownerId: "owner12345",
   } as {
      credentials: string;
      provider: "Other" | "S3";
      ownerId: string;
   } | null,
   findUnique: vi.fn(),
   decrypt: vi.fn(),
   assertPublicEndpoint: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      server: { findUnique: state.findUnique },
   },
}));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@/lib/utils/endpoint", () => ({
   PRIVATE_ADDRESS_CODE: "EPRIVATEADDRESS",
   assertPublicEndpoint: state.assertPublicEndpoint,
   publicOnlyLookup: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
   logger: { warn: vi.fn(), info: vi.fn() },
}));

const serverId = "server12345";

const rotate = (credentials = "new", provider: "Other" | "S3" = "Other") => {
   state.snapshot = { credentials, provider, ownerId: "owner12345" };
};

beforeEach(() => {
   vi.useRealTimers();
   invalidateS3Client(serverId);
   rotate("old");
   state.findUnique
      .mockReset()
      .mockImplementation(async () =>
         state.snapshot ? { ...state.snapshot } : null
      );
   state.decrypt.mockReset().mockImplementation((blob: string) => ({
      endpoint: `https://${blob}.example.com`,
      region: "us-east-1",
      accessKey: blob,
      secretKey: "secret",
   }));
   state.assertPublicEndpoint.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("folder guard", () => {
   const guarded = (client: S3Client): boolean =>
      client.middlewareStack
         .identify()
         .some((entry) => entry.startsWith("folderGuard"));

   it("is on the cached client every route receives", async () => {
      expect(guarded(await getS3Client({ serverId }))).toBe(true);
   });

   it("is on a client built straight from a server's credentials", () => {
      const credentials = {
         endpoint: "https://s3.example.com",
         region: "us-east-1",
         accessKey: "key",
         secretKey: "secret",
      };
      expect(
         guarded(
            getS3ClientFromCredentials(credentials, Provider.Other, serverId)
         )
      ).toBe(true);
   });
});

describe("S3 client credential authority", () => {
   it.each(["invalidation", "rotation", "deletion", "expiry"])(
      "clears regional clients when the base client is removed by %s",
      async (reason) => {
         state.decrypt.mockImplementation((blob: string) => ({
            endpoint: "https://s3.us-east-1.amazonaws.com",
            region: "us-east-1",
            accessKey: blob,
            secretKey: "secret",
         }));
         vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
            BucketRegion: "eu-west-1",
         } as never);
         const old = await getS3Client({ serverId });
         await getBucketClient(old, "photos");
         if (reason === "invalidation") invalidateS3Client(serverId);
         else if (reason === "rotation") {
            rotate();
            await getS3Client({ serverId });
         } else if (reason === "deletion") {
            state.snapshot = null;
            await expect(getS3Client({ serverId })).rejects.toMatchObject({
               kind: "notFound",
            });
         } else {
            vi.useFakeTimers();
            vi.advanceTimersByTime(10 * 60_000);
            await getS3Client({ serverId });
         }
         await expect(getBucketClient(old, "photos")).rejects.toMatchObject({
            kind: "conflict",
         });
      }
   );

   it("clears regional clients when cache capacity evicts their base client", async () => {
      state.decrypt.mockReturnValue({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: "old",
         secretKey: "secret",
      });
      vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
         BucketRegion: "eu-west-1",
      } as never);
      const old = await getS3Client({ serverId });
      await getBucketClient(old, "photos");
      const ids = Array.from(
         { length: 500 },
         (_, index) => `cache-capacity-${index}`
      );
      try {
         for (const id of ids) await getS3Client({ serverId: id });
         await expect(getBucketClient(old, "photos")).rejects.toMatchObject({
            kind: "conflict",
         });
      } finally {
         ids.forEach(invalidateS3Client);
      }
   });

   it("gives each server its own connection pool and closes its idle sockets on removal", async () => {
      type HandlerConfig = {
         httpAgentProvider: () => Promise<HttpAgent>;
         httpsAgent: HttpsAgent;
      };
      const agentsOf = async (client: S3Client) => {
         const config = await (
            client.config.requestHandler as unknown as {
               configProvider: Promise<HandlerConfig>;
            }
         ).configProvider;
         return {
            httpAgent: await config.httpAgentProvider(),
            httpsAgent: config.httpsAgent,
         };
      };
      const other = "other-server";
      try {
         const mine = await agentsOf(await getS3Client({ serverId }));
         const theirs = await agentsOf(await getS3Client({ serverId: other }));
         expect(mine.httpAgent).not.toBe(theirs.httpAgent);
         expect(mine.httpsAgent).not.toBe(theirs.httpsAgent);
         const idle = { destroy: vi.fn() };
         (mine.httpsAgent.freeSockets as Record<string, unknown[]>)[
            "storage.example.com:443:"
         ] = [idle];
         invalidateS3Client(serverId);
         expect(idle.destroy).toHaveBeenCalledOnce();
         expect(mine.httpsAgent.maxFreeSockets).toBe(0);
         expect(mine.httpAgent.maxFreeSockets).toBe(0);
         expect(theirs.httpsAgent.maxFreeSockets).toBeGreaterThan(0);
      } finally {
         invalidateS3Client(other);
      }
   });

   it("keeps a client that stays in use while capacity evicts idle ones", async () => {
      const busy = await getS3Client({ serverId });
      const ids = Array.from(
         { length: 500 },
         (_, index) => `cache-recency-${index}`
      );
      try {
         for (const id of ids) {
            await getS3Client({ serverId: id });
            expect(await getS3Client({ serverId })).toBe(busy);
         }
      } finally {
         ids.forEach(invalidateS3Client);
      }
   });

   it("retries authority after local invalidation during region discovery", async () => {
      state.decrypt.mockImplementation((blob: string) => ({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: blob,
         secretKey: "secret",
      }));
      vi.spyOn(S3Client.prototype, "send")
         .mockImplementationOnce(async () => {
            rotate();
            invalidateS3Client(serverId);
            return { BucketRegion: "eu-west-1" };
         })
         .mockResolvedValue({ BucketRegion: "eu-west-1" } as never);
      const fresh = await getS3Client({ serverId }, "photos");
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it.each([
      [
         "a missing bucket",
         Object.assign(new Error("Not Found"), {
            name: "NotFound",
            $metadata: { httpStatusCode: 404 },
            $response: { statusCode: 404, headers: {} },
         }),
         { kind: "notFound", message: "Bucket not found" },
      ],
      [
         "a discovery timeout",
         Object.assign(new Error("Timed out"), { name: "TimeoutError" }),
         { kind: "upstream", message: "Couldn't reach the storage endpoint" },
      ],
   ])(
      "answers %s during region discovery as a storage error",
      async (_case, failure, expected) => {
         state.decrypt.mockImplementation((blob: string) => ({
            endpoint: "https://s3.us-east-1.amazonaws.com",
            region: "us-east-1",
            accessKey: blob,
            secretKey: "secret",
         }));
         vi.spyOn(S3Client.prototype, "send").mockRejectedValue(
            failure as never
         );
         await expect(
            getS3Client({ serverId }, "photos")
         ).rejects.toMatchObject({ name: "StorageError", ...expected });
      }
   );

   it("reads persisted credentials for every hit without repeating decryption or DNS", async () => {
      const first = await getS3Client({ serverId });
      expect(await getS3Client({ serverId })).toBe(first);
      expect(state.findUnique).toHaveBeenCalledTimes(3);
      expect(state.decrypt).toHaveBeenCalledTimes(1);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(1);
   });

   it("skips the authority read when the route hands over the snapshot it authorized with", async () => {
      const first = await getS3Client({ serverId });
      state.findUnique.mockClear();
      const known = { ...state.snapshot! };
      expect(await getS3Client({ serverId, credentials: known })).toBe(first);
      expect(state.findUnique).not.toHaveBeenCalled();
   });

   it("confirms a handed-over snapshot against storage before building a client from it", async () => {
      const stale = { ...state.snapshot! };
      rotate();
      const fresh = await getS3Client({ serverId, credentials: stale });
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
      expect(state.findUnique).toHaveBeenCalledTimes(3);
   });

   it("rotates another replica's cached endpoint and keys without local invalidation", async () => {
      const original = await getS3Client({ serverId });
      vi.resetModules();
      const replica = await import("./client-cache");
      const replicaOriginal = await replica.getS3Client({ serverId });
      rotate();
      invalidateS3Client(serverId);
      const [updated, replicaUpdated] = await Promise.all([
         getS3Client({ serverId }),
         replica.getS3Client({ serverId }),
      ]);
      expect(updated).not.toBe(original);
      expect(replicaUpdated).not.toBe(replicaOriginal);
      for (const client of [updated, replicaUpdated]) {
         expect((await client.config.credentials()).accessKeyId).toBe("new");
         expect((await client.config.endpoint!()).hostname).toBe(
            "new.example.com"
         );
      }
      replica.invalidateS3Client(serverId);
   });

   it("rebuilds when only the stored provider changes", async () => {
      const first = await getS3Client({ serverId });
      rotate("old", Provider.S3);
      const second = await getS3Client({ serverId });
      expect(second).not.toBe(first);
      expect(second.config.forcePathStyle).toBe(false);
      expect(first.config.forcePathStyle).toBe(true);
   });

   it("replaces a cached session token even when endpoint and key pair stay the same", async () => {
      state.decrypt.mockImplementation((blob: string) => ({
         endpoint: "https://s3.amazonaws.com",
         region: "us-east-1",
         accessKey: "access-key",
         secretKey: "secret-key",
         sessionToken: blob,
      }));
      const original = await getS3Client({ serverId });
      expect((await original.config.credentials()).sessionToken).toBe("old");
      rotate("new-token");
      const updated = await getS3Client({ serverId });
      expect(updated).not.toBe(original);
      expect((await updated.config.credentials()).sessionToken).toBe(
         "new-token"
      );
   });

   it("expires the cached endpoint validation", async () => {
      vi.useFakeTimers();
      const first = await getS3Client({ serverId });
      vi.advanceTimersByTime(10 * 60_000);
      expect(await getS3Client({ serverId })).not.toBe(first);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(2);
   });

   it("never falls back to cached credentials if the authority read fails", async () => {
      await getS3Client({ serverId });
      const failure = new Error("Database unavailable");
      state.findUnique.mockRejectedValue(failure);
      await expect(getS3Client({ serverId })).rejects.toBe(failure);
   });

   it("refuses malformed credentials after rotation instead of returning the old client", async () => {
      await getS3Client({ serverId });
      rotate();
      state.decrypt.mockImplementation(() => {
         throw new Error("Invalid ciphertext");
      });
      await expect(getS3Client({ serverId })).rejects.toMatchObject({
         kind: "conflict",
         code: "CREDENTIALS_UNREADABLE",
      });
   });

   it("rechecks endpoint safety after rotation and does not fall back to the old client", async () => {
      await getS3Client({ serverId });
      rotate();
      const failure = new Error("Private endpoint");
      state.assertPublicEndpoint.mockRejectedValue(failure);
      await expect(getS3Client({ serverId })).rejects.toBe(failure);
   });

   it("does not return or recache a stale fill that completes after a remote rotation", async () => {
      const started = Promise.withResolvers<void>();
      const complete = Promise.withResolvers<void>();
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started.resolve();
         await complete.promise;
      });
      const pending = getS3Client({ serverId });
      await started.promise;
      rotate();
      const joined = getS3Client({ serverId });
      complete.resolve();
      const fresh = await joined;
      expect(await pending).toBe(fresh);
      expect(await getS3Client({ serverId })).toBe(fresh);
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it("cancels a caller waiting for credentials without cancelling the shared fill", async () => {
      const started = Promise.withResolvers<void>();
      const complete = Promise.withResolvers<void>();
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started.resolve();
         await complete.promise;
      });
      const controller = new AbortController();
      const first = getS3Client({ serverId }, "photos", controller.signal);
      const rejected = expect(first).rejects.toMatchObject({
         name: "AbortError",
      });
      await started.promise;
      const second = getS3Client({ serverId }, "photos");
      controller.abort();
      await rejected;
      complete.resolve();
      await expect(second).resolves.toBeInstanceOf(S3Client);
      expect(state.decrypt).toHaveBeenCalledTimes(1);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(1);
   });

   it("fills once for concurrent misses and hands every caller the same client", async () => {
      const clients = await Promise.all(
         Array.from({ length: 10 }, () => getS3Client({ serverId }))
      );
      expect(new Set(clients).size).toBe(1);
      expect(state.decrypt).toHaveBeenCalledTimes(1);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(1);
      expect(state.findUnique).toHaveBeenCalledTimes(2);
   });

   it("lets a caller arriving after a local invalidation start its own fill", async () => {
      const started = Promise.withResolvers<void>();
      const complete = Promise.withResolvers<void>();
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started.resolve();
         await complete.promise;
      });
      const pending = getS3Client({ serverId });
      await started.promise;
      rotate();
      invalidateS3Client(serverId);
      const fresh = await getS3Client({ serverId });
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
      complete.resolve();
      expect(await pending).toBe(fresh);
   });

   it("does not return a fill when its server was deleted during endpoint validation", async () => {
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         state.snapshot = null;
      });
      await expect(getS3Client({ serverId })).rejects.toMatchObject({
         kind: "notFound",
      });
   });

   it("retries a cached authority read that raced local invalidation", async () => {
      const old = await getS3Client({ serverId });
      state.findUnique.mockImplementationOnce(async () => {
         const snapshot = state.snapshot;
         rotate();
         invalidateS3Client(serverId);
         return snapshot;
      });
      const fresh = await getS3Client({ serverId });
      expect(fresh).not.toBe(old);
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it("fails closed after bounded retries when credentials keep rotating", async () => {
      state.assertPublicEndpoint.mockImplementation(async () => {
         rotate(`${state.snapshot?.credentials}-rotated`);
      });
      await expect(getS3Client({ serverId })).rejects.toMatchObject({
         kind: "conflict",
      });
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(3);
      expect(state.findUnique).toHaveBeenCalledTimes(6);
   });

   it("rebuilds regional clients with fresh credentials after rotation", async () => {
      state.decrypt.mockImplementation((blob: string) => ({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: blob,
         secretKey: "secret",
         sessionToken: `${blob}-token`,
      }));
      vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
         BucketRegion: "eu-west-1",
      } as never);
      const old = await getS3Client({ serverId }, "photos");
      rotate();
      const fresh = await getS3Client({ serverId }, "photos");
      expect(fresh).not.toBe(old);
      expect(await fresh.config.region()).toBe("eu-west-1");
      expect(await fresh.config.credentials()).toMatchObject({
         accessKeyId: "new",
         sessionToken: "new-token",
      });
   });

   it("rechecks authority after region discovery races credential rotation", async () => {
      state.decrypt.mockImplementation((blob: string) => ({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: blob,
         secretKey: "secret",
      }));
      vi.spyOn(S3Client.prototype, "send")
         .mockImplementationOnce(async () => {
            rotate();
            return { BucketRegion: "eu-west-1" };
         })
         .mockResolvedValue({ BucketRegion: "eu-west-1" } as never);
      const fresh = await getS3Client({ serverId }, "photos");
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it("reads the credential authority once when the regional client is already cached", async () => {
      state.decrypt.mockReturnValue({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: "old",
         secretKey: "secret",
      });
      vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
         BucketRegion: "eu-west-1",
      } as never);
      const first = await getS3Client({ serverId }, "photos");
      expect(state.findUnique).toHaveBeenCalledTimes(3);
      state.findUnique.mockClear();
      expect(await getS3Client({ serverId }, "photos")).toBe(first);
      expect(state.findUnique).toHaveBeenCalledTimes(1);
   });

   it("does not return a regional client after deletion during region discovery", async () => {
      state.decrypt.mockReturnValue({
         endpoint: "https://s3.us-east-1.amazonaws.com",
         region: "us-east-1",
         accessKey: "old",
         secretKey: "secret",
      });
      vi.spyOn(S3Client.prototype, "send").mockImplementationOnce(async () => {
         state.snapshot = null;
         return { BucketRegion: "eu-west-1" };
      });
      await expect(getS3Client({ serverId }, "photos")).rejects.toMatchObject({
         kind: "notFound",
      });
   });
});

describe("clients built straight from caller credentials", () => {
   const credentials = {
      endpoint: "https://s3.example.com",
      region: "us-east-1",
      accessKey: "AKIA",
      secretKey: "secret",
   };

   it("shares one budget per storage account, and uses the server id when there is one", () => {
      const first = getS3ClientFromCredentials(credentials);
      const same = getS3ClientFromCredentials({ ...credentials });
      const otherKey = getS3ClientFromCredentials({
         ...credentials,
         accessKey: "AKIB",
      });
      const otherEndpoint = getS3ClientFromCredentials({
         ...credentials,
         endpoint: "https://s3.elsewhere.com",
      });
      const named = getS3ClientFromCredentials(
         credentials,
         Provider.Other,
         serverId
      );
      expect(budgetServerOf(first)).toMatch(/^credentials:/);
      expect(budgetServerOf(same)).toBe(budgetServerOf(first));
      expect(budgetServerOf(otherKey)).not.toBe(budgetServerOf(first));
      expect(budgetServerOf(otherEndpoint)).not.toBe(budgetServerOf(first));
      expect(budgetServerOf(named)).toBe(serverId);
   });

   it("bounds the wait for a response head so a tarpit cannot hold a socket forever", async () => {
      const client = getS3ClientFromCredentials(credentials);
      const handler = client.config.requestHandler as unknown as {
         configProvider: Promise<Record<string, unknown>>;
      };
      await expect(handler.configProvider).resolves.toMatchObject({
         requestTimeout: env.S3_REQUEST_TIMEOUT_MS,
         throwOnRequestTimeout: true,
      });
   });

   it.each([
      [Provider.S3, "WHEN_SUPPORTED"],
      [Provider.R2, "WHEN_REQUIRED"],
      [Provider.Other, "WHEN_REQUIRED"],
   ])(
      "computes request checksums for %s only %s",
      async (provider, expected) => {
         const client = getS3ClientFromCredentials(credentials, provider);
         await expect(client.config.requestChecksumCalculation()).resolves.toBe(
            expected
         );
      }
   );
});
