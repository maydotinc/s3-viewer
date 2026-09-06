import { Provider } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getS3Client, invalidateS3Client } from "./client-cache";

const state = vi.hoisted(() => ({
   snapshot: { credentials: "old", provider: "Other" } as {
      credentials: string;
      provider: "Other" | "S3";
   } | null,
   findUnique: vi.fn(),
   decrypt: vi.fn(),
   assertPublicEndpoint: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: { server: { findUnique: state.findUnique } },
}));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@/lib/utils/endpoint", () => ({
   PRIVATE_ADDRESS_CODE: "EPRIVATEADDRESS",
   assertPublicEndpoint: state.assertPublicEndpoint,
   publicOnlyLookup: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

const serverId = "server12345";

const rotate = (credentials = "new", provider: "Other" | "S3" = "Other") => {
   state.snapshot = { credentials, provider };
};

const deferred = () => {
   let resolve!: () => void;
   const promise = new Promise<void>((done) => {
      resolve = done;
   });
   return { promise, resolve };
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

describe("S3 client credential authority", () => {
   it("reads persisted credentials for every hit without repeating decryption or DNS", async () => {
      const first = await getS3Client(serverId);
      expect(await getS3Client(serverId)).toBe(first);
      expect(state.findUnique).toHaveBeenCalledTimes(3);
      expect(state.decrypt).toHaveBeenCalledTimes(1);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(1);
   });

   it("rotates another replica's cached endpoint and keys without local invalidation", async () => {
      const original = await getS3Client(serverId);
      vi.resetModules();
      const replica = await import("./client-cache");
      const replicaOriginal = await replica.getS3Client(serverId);
      rotate();
      invalidateS3Client(serverId);
      const [updated, replicaUpdated] = await Promise.all([
         getS3Client(serverId),
         replica.getS3Client(serverId),
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
      const first = await getS3Client(serverId);
      rotate("old", Provider.S3);
      const second = await getS3Client(serverId);
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
      const original = await getS3Client(serverId);
      expect((await original.config.credentials()).sessionToken).toBe("old");
      rotate("new-token");
      const updated = await getS3Client(serverId);
      expect(updated).not.toBe(original);
      expect((await updated.config.credentials()).sessionToken).toBe(
         "new-token"
      );
   });

   it("expires the cached endpoint validation", async () => {
      vi.useFakeTimers();
      const first = await getS3Client(serverId);
      vi.advanceTimersByTime(10 * 60_000);
      expect(await getS3Client(serverId)).not.toBe(first);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(2);
   });

   it("refuses a cached client after the server is deleted", async () => {
      await getS3Client(serverId);
      state.snapshot = null;
      await expect(getS3Client(serverId)).rejects.toMatchObject({
         status: 404,
      });
   });

   it("never falls back to cached credentials if the authority read fails", async () => {
      await getS3Client(serverId);
      const failure = new Error("Database unavailable");
      state.findUnique.mockRejectedValue(failure);
      await expect(getS3Client(serverId)).rejects.toBe(failure);
   });

   it("refuses malformed credentials after rotation instead of returning the old client", async () => {
      await getS3Client(serverId);
      rotate();
      state.decrypt.mockImplementation(() => {
         throw new Error("Invalid ciphertext");
      });
      await expect(getS3Client(serverId)).rejects.toMatchObject({
         status: 409,
         code: "CREDENTIALS_UNREADABLE",
      });
   });

   it("rechecks endpoint safety after rotation and does not fall back to the old client", async () => {
      await getS3Client(serverId);
      rotate();
      const failure = new Error("Private endpoint");
      state.assertPublicEndpoint.mockRejectedValue(failure);
      await expect(getS3Client(serverId)).rejects.toBe(failure);
   });

   it("does not return or recache a stale fill that completes after a remote rotation", async () => {
      const started = deferred();
      const complete = deferred();
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started.resolve();
         await complete.promise;
      });
      const pending = getS3Client(serverId);
      await started.promise;
      rotate();
      const fresh = await getS3Client(serverId);
      complete.resolve();
      expect(await pending).toBe(fresh);
      expect(await getS3Client(serverId)).toBe(fresh);
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it("does not return a fill when its server was deleted during endpoint validation", async () => {
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         state.snapshot = null;
      });
      await expect(getS3Client(serverId)).rejects.toMatchObject({
         status: 404,
      });
   });

   it("retries a cached authority read that raced local invalidation", async () => {
      const old = await getS3Client(serverId);
      state.findUnique.mockImplementationOnce(async () => {
         const snapshot = state.snapshot;
         rotate();
         invalidateS3Client(serverId);
         return snapshot;
      });
      const fresh = await getS3Client(serverId);
      expect(fresh).not.toBe(old);
      expect((await fresh.config.credentials()).accessKeyId).toBe("new");
   });

   it("fails closed after bounded retries when credentials keep rotating", async () => {
      state.assertPublicEndpoint.mockImplementation(async () => {
         rotate(`${state.snapshot?.credentials}-rotated`);
      });
      await expect(getS3Client(serverId)).rejects.toMatchObject({
         status: 409,
      });
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(3);
      expect(state.findUnique).toHaveBeenCalledTimes(6);
   });
});
