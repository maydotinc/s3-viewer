import {
   DeleteObjectCommand,
   GetObjectCommand,
   ListObjectsV2Command,
   S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBucketClient, invalidateBucketClients } from "./bucket-client";
import { presignedUrl } from "./presign";
import { withoutRetries } from "./no-retry";
import { canHeadBucket } from "./probe";

const state = vi.hoisted(() => ({ assertPublicEndpoint: vi.fn() }));
vi.mock("../utils/endpoint", () => ({
   assertPublicEndpoint: state.assertPublicEndpoint,
   PRIVATE_ADDRESS_CODE: "EPRIVATEADDRESS",
}));

type Request = {
   method: string;
   hostname: string;
   headers: Record<string, string>;
};
const reply = (
   statusCode = 200,
   headers: Record<string, string> = {},
   body = ""
) => ({
   response: { statusCode, headers, body: Readable.from([body]) },
});
const clientFor = (
   handle: (request: Request) => Promise<ReturnType<typeof reply>>,
   endpoint = "https://s3.us-east-1.amazonaws.com"
) =>
   new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: {
         accessKeyId: "access-key",
         secretAccessKey: "secret-key",
         sessionToken: "session-token",
      },
      maxAttempts: 2,
      followRegionRedirects: false,
      requestHandler: { handle },
   });

afterEach(() => {
   vi.useRealTimers();
   state.assertPublicEndpoint.mockReset();
});

describe("AWS bucket regions", () => {
   it("invalidates every cached bucket without destroying the shared transport", async () => {
      const handle = vi.fn(async () =>
         reply(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const base = clientFor(handle);
      const destroy = vi.fn();
      base.config.requestHandler.destroy = destroy;
      await getBucketClient(base, "photos");
      await getBucketClient(base, "logs");
      invalidateBucketClients(base);
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         status: 409,
      });
      await expect(getBucketClient(base, "logs")).rejects.toMatchObject({
         status: 409,
      });
      expect(handle).toHaveBeenCalledTimes(2);
      expect(destroy).not.toHaveBeenCalled();
   });

   it("does not refill regional caches after invalidation during DNS discovery", async () => {
      let finish!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
         started = resolve;
      });
      const pendingDns = new Promise<void>((resolve) => {
         finish = resolve;
      });
      state.assertPublicEndpoint.mockImplementationOnce(async () => {
         started();
         await pendingDns;
      });
      const base = clientFor(async () =>
         reply(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      const pending = getBucketClient(base, "photos");
      await entered;
      invalidateBucketClients(base);
      finish();
      await expect(pending).rejects.toMatchObject({ status: 409 });
      await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
         status: 409,
      });
   });

   it.each([200, 301, 400, 403])(
      "discovers region from HeadBucket HTTP %s before requests and presigning",
      async (status) => {
         const requests: Request[] = [];
         const base = clientFor(async (request) => {
            requests.push(request);
            return request.method === "HEAD"
               ? reply(status, { "x-amz-bucket-region": "eu-west-1" })
               : reply(
                    200,
                    {},
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
         return reply(200, {
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

   it.each([
      "https://account.r2.cloudflarestorage.com",
      "https://s3.us-west-004.backblazeb2.com",
      "https://minio.example.test",
   ])(
      "leaves the endpoint and signing region intact for %s",
      async (endpoint) => {
         const handle = vi.fn();
         const base = clientFor(handle, endpoint);
         expect(await getBucketClient(base, "photos")).toBe(base);
         expect(handle).not.toHaveBeenCalled();
         expect(state.assertPublicEndpoint).not.toHaveBeenCalled();
      }
   );

   it.each(["localhost", "eu-west-1.evil.test", "cn-north-1", ""])(
      "rejects an invalid or cross-partition region %s",
      async (region) => {
         const base = clientFor(async () =>
            reply(200, { "x-amz-bucket-region": region })
         );
         await expect(getBucketClient(base, "photos")).rejects.toMatchObject({
            status: 502,
         });
         expect(state.assertPublicEndpoint).not.toHaveBeenCalled();
      }
   );

   it("propagates a missing bucket without caching a guessed region", async () => {
      const handle = vi.fn(async () => reply(404));
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
      const requests: Request[] = [];
      const base = clientFor(async (request) => {
         requests.push(request);
         return request.method === "HEAD"
            ? reply(200, { "x-amz-bucket-region": "eu-west-1" })
            : reply(301, { "x-amz-bucket-region": "us-west-2" });
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
      const requests: Request[] = [];
      const base = clientFor(async (request) => {
         requests.push(request);
         return reply(request.hostname.includes("eu-west-1") ? 200 : 301, {
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

   it("keeps public endpoint validation on the new regional host", async () => {
      const failure = new Error("Private endpoint");
      state.assertPublicEndpoint.mockRejectedValueOnce(failure);
      const base = clientFor(async () =>
         reply(200, { "x-amz-bucket-region": "eu-west-1" })
      );
      await expect(getBucketClient(base, "photos")).rejects.toBe(failure);
   });
});
