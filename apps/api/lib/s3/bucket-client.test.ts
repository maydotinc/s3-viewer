import {
   DeleteObjectCommand,
   GetObjectCommand,
   ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   empty,
   reply,
   s3Fixture,
   type FixtureHandle,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { getBucketClient, invalidateBucketClients } from "./bucket-client";
import { presignedUrl } from "./presign";
import { withoutRetries } from "./no-retry";
import { assertCredentialsWork, canHeadBucket } from "./probe";
import { resetRequestBudgets, withRequestBudget } from "./request-budget";
import { cappedStreamCollector } from "./response-collector";

const state = vi.hoisted(() => ({ assertPublicEndpoint: vi.fn() }));
vi.mock("@/lib/utils/endpoint", () => ({
   assertPublicEndpoint: state.assertPublicEndpoint,
   PRIVATE_ADDRESS_CODE: "EPRIVATEADDRESS",
}));
vi.mock("@/lib/env", async (original) => {
   const actual = await original<typeof import("@/lib/env")>();
   return { ...actual, env: { ...actual.env, S3_REQUESTS_PER_MINUTE: 1 } };
});

const clientFor = (handle: FixtureHandle, endpoint = AWS_ENDPOINT) =>
   s3Fixture(handle, {
      endpoint,
      forcePathStyle: false,
      maxAttempts: 2,
      credentials: {
         accessKeyId: "access-key",
         secretAccessKey: "secret-key",
         sessionToken: "session-token",
      },
   }).client;

afterEach(() => {
   vi.useRealTimers();
   state.assertPublicEndpoint.mockReset();
   resetRequestBudgets();
});

describe("AWS bucket regions", () => {
   it("shares transport and the discovery request's budget with its regional clone", async () => {
      const handle = vi.fn(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const base = withRequestBudget(clientFor(handle), "regional-budget");
      const regional = await getBucketClient(base, "photos");
      expect(regional.config.requestHandler).toBe(base.config.requestHandler);
      expect(regional.config.streamCollector).toBe(cappedStreamCollector);
      expect(await regional.config.maxAttempts()).toBe(2);
      await expect(
         regional.send(new ListObjectsV2Command({ Bucket: "photos" }))
      ).rejects.toMatchObject({ kind: "rateLimited" });
      expect(handle).toHaveBeenCalledTimes(1);
   });
   it("invalidates every cached bucket without destroying the shared transport", async () => {
      const handle = vi.fn(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const base = clientFor(handle);
      const destroy = vi.fn();
      base.config.requestHandler.destroy = destroy;
      await getBucketClient(base, "photos");
      await getBucketClient(base, "logs");
      invalidateBucketClients(base);
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         kind: "conflict",
      });
      await expect(getBucketClient(base, "logs")).rejects.toMatchObject({
         kind: "conflict",
      });
      expect(handle).toHaveBeenCalledTimes(2);
      expect(destroy).not.toHaveBeenCalled();
   });

   it("does not refill regional caches after invalidation during DNS discovery", async () => {
      const { promise: entered, resolve: started } =
         Promise.withResolvers<void>();
      const { promise: pendingDns, resolve: finish } =
         Promise.withResolvers<void>();
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started();
         await pendingDns;
      });
      const base = clientFor(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const pending = getBucketClient(base, "photos");
      await entered;
      invalidateBucketClients(base);
      finish();
      await expect(pending).rejects.toMatchObject({ kind: "conflict" });
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         kind: "conflict",
      });
   });

   it("discovers once for concurrent misses on one bucket", async () => {
      const handle = vi.fn(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const base = clientFor(handle);
      const clients = await Promise.all(
         Array.from({ length: 10 }, () => getBucketClient(base, "photos"))
      );
      expect(new Set(clients).size).toBe(1);
      expect(handle).toHaveBeenCalledTimes(1);
      expect(state.assertPublicEndpoint).toHaveBeenCalledTimes(1);
   });

   it("fails only the caller that disconnected mid-discovery, not the ones sharing it", async () => {
      const { promise: pendingDns, resolve: finish } =
         Promise.withResolvers<void>();
      state.assertPublicEndpoint.mockImplementationOnce(() => pendingDns);
      const base = clientFor(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const gone = new AbortController();
      const leaving = getBucketClient(base, "photos", gone.signal);
      const staying = getBucketClient(base, "photos");
      gone.abort(new Error("client went away"));
      await expect(leaving).rejects.toThrow("client went away");
      finish();
      expect(await (await staying).config.region()).toBe("eu-west-1");
      expect(await getBucketClient(base, "photos")).toBe(await staying);
   });

   it("gives a stalled shared discovery its own deadline so the next caller starts afresh", async () => {
      const deadline = new AbortController();
      vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(deadline.signal);
      const handle = vi
         .fn()
         .mockImplementationOnce(
            (
               _request: FixtureRequest,
               { abortSignal }: { abortSignal?: AbortSignal }
            ) =>
               new Promise((_, reject) => {
                  abortSignal?.addEventListener("abort", () =>
                     reject(
                        Object.assign(new Error("FixtureRequest aborted"), {
                           name: "AbortError",
                        })
                     )
                  );
               })
         )
         .mockImplementation(async () =>
            empty(200, { "x-amz-bucket-region": "eu-west-1" })
         );
      const base = clientFor(handle);
      const stalled = getBucketClient(base, "photos");
      await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(1));
      deadline.abort(new DOMException("timed out", "TimeoutError"));
      await expect(stalled).rejects.toBeDefined();
      const next = await getBucketClient(base, "photos");
      expect(await next.config.region()).toBe("eu-west-1");
      expect(handle).toHaveBeenCalledTimes(2);
   });

   it("does not start a discovery for a caller that has already given up", async () => {
      const handle = vi.fn();
      const base = clientFor(handle);
      await expect(
         getBucketClient(base, "photos", AbortSignal.abort())
      ).rejects.toBeDefined();
      expect(handle).not.toHaveBeenCalled();
   });

   it.each([200, 301, 400, 403])(
      "discovers region from HeadBucket HTTP %s before requests and presigning",
      async (status) => {
         const requests: FixtureRequest[] = [];
         const base = clientFor(async (request) => {
            requests.push(request);
            return request.method === "HEAD"
               ? empty(status, { "x-amz-bucket-region": "eu-west-1" })
               : reply(
                    200,
                    "<ListBucketResult><Name>photos</Name></ListBucketResult>"
                 );
         });
         const regional = await getBucketClient(base, "photos");
         await regional.send(new ListObjectsV2Command({ Bucket: "photos" }));
         expect(requests.map(({ hostname }) => hostname)).toEqual([
            "photos.s3.us-east-1.amazonaws.com",
            "photos.s3.eu-west-1.amazonaws.com",
         ]);
         expect(requests[1]!.headers.authorization).toContain(
            "/eu-west-1/s3/aws4_request"
         );
         expect(requests[1]!.headers["x-amz-security-token"]).toBe(
            "session-token"
         );
         const signed = new URL(
            (
               await presignedUrl(
                  regional,
                  new GetObjectCommand({ Bucket: "photos", Key: "photo.jpg" })
               )
            ).url
         );
         expect(signed.hostname).toBe("photos.s3.eu-west-1.amazonaws.com");
         expect(signed.searchParams.get("X-Amz-Credential")).toContain(
            "/eu-west-1/s3/aws4_request"
         );
         expect(signed.searchParams.get("X-Amz-Security-Token")).toBe(
            "session-token"
         );
         expect(requests).toHaveLength(2);
         expect(state.assertPublicEndpoint).toHaveBeenCalledWith(
            "https://s3.eu-west-1.amazonaws.com"
         );
         expect(await getBucketClient(base, "photos")).toBe(regional);
         expect(requests).toHaveLength(2);
      }
   );

   it("resolves a different region for each bucket and refreshes after the TTL", async () => {
      vi.useFakeTimers();
      let calls = 0;
      const base = clientFor(async ({ hostname }) => {
         calls++;
         return empty(200, {
            "x-amz-bucket-region": hostname.startsWith("photos.")
               ? "eu-west-1"
               : "us-west-2",
         });
      });
      const photos = await getBucketClient(base, "photos");
      const logs = await getBucketClient(base, "logs");
      expect(await photos.config.region()).toBe("eu-west-1");
      expect(await logs.config.region()).toBe("us-west-2");
      expect(await getBucketClient(base, "photos")).toBe(photos);
      vi.advanceTimersByTime(10 * 60_000);
      expect(await getBucketClient(base, "photos")).not.toBe(photos);
      expect(calls).toBe(3);
   });

   // every provider but AWS returns before region discovery.
   it("leaves the endpoint and signing region intact for non-AWS storage", async () => {
      const handle = vi.fn();
      const base = clientFor(handle, "https://minio.example.test");
      expect(await getBucketClient(base, "photos")).toBe(base);
      expect(handle).not.toHaveBeenCalled();
      expect(state.assertPublicEndpoint).not.toHaveBeenCalled();
   });

   it.each(["localhost", "eu-west-1.evil.test", "cn-north-1", ""])(
      "rejects an invalid or cross-partition region %s",
      async (region) => {
         const base = clientFor(async () =>
            empty(200, { "x-amz-bucket-region": region })
         );
         await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
            kind: "upstream",
         });
         expect(state.assertPublicEndpoint).not.toHaveBeenCalled();
      }
   );

   it("propagates a missing bucket without caching a guessed region", async () => {
      const handle = vi.fn(async () => empty(404));
      const base = clientFor(handle);
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         $metadata: { httpStatusCode: 404 },
      });
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         $metadata: { httpStatusCode: 404 },
      });
      expect(handle).toHaveBeenCalledTimes(2);
   });

   it("does not follow a redirect or retry a destructive request", async () => {
      const requests: FixtureRequest[] = [];
      const base = clientFor(async (request) => {
         requests.push(request);
         return request.method === "HEAD"
            ? empty(200, { "x-amz-bucket-region": "eu-west-1" })
            : empty(301, { "x-amz-bucket-region": "us-west-2" });
      });
      const once = withoutRetries(await getBucketClient(base, "photos"));
      await expect(
         once.send(
            new DeleteObjectCommand({
               Bucket: "photos",
               Key: "photo.jpg",
               IfMatch: '"etag"',
            })
         )
      ).rejects.toMatchObject({ $metadata: { httpStatusCode: 301 } });
      expect(requests.map(({ method }) => method)).toEqual(["HEAD", "DELETE"]);
   });

   it("validates access at the discovered region for named-bucket connection setup", async () => {
      const requests: FixtureRequest[] = [];
      const base = clientFor(async (request) => {
         requests.push(request);
         return empty(request.hostname.includes("eu-west-1") ? 200 : 301, {
            "x-amz-bucket-region": "eu-west-1",
         });
      });
      expect(
         await canHeadBucket(base, "photos", new AbortController().signal)
      ).toBe(true);
      expect(requests.map(({ hostname }) => hostname)).toEqual([
         "photos.s3.us-east-1.amazonaws.com",
         "photos.s3.eu-west-1.amazonaws.com",
      ]);
   });

   it("reports why region discovery failed during connection setup", async () => {
      const base = clientFor(async () =>
         empty(200, { "x-amz-bucket-region": "cn-north-1" })
      );
      const partition = {
         kind: "upstream",
         message: "Storage returned a region in another AWS partition",
      };
      await expect(
         canHeadBucket(base, "photos", new AbortController().signal)
      ).rejects.toMatchObject(partition);
      await expect(
         assertCredentialsWork(
            base,
            ["photos"],
            "Rotate credentials",
            new AbortController().signal
         )
      ).rejects.toMatchObject(partition);
   });

   it("keeps public endpoint validation on the new regional host", async () => {
      const failure = new Error("Private endpoint");
      state.assertPublicEndpoint.mockRejectedValueOnce(failure);
      const base = clientFor(async () =>
         empty(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      await expect(getBucketClient(base, "photos")).rejects.toBe(failure);
   });
});
