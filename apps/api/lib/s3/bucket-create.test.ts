import { Provider } from "@s3-viewer/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
   empty,
   errorXml,
   reply,
   s3Fixture,
   type FixtureReply,
} from "@/lib/testing/s3-fixture";
import { createNewBucket } from "./bucket-create";
import { installReadBudget } from "./read-budget.fixture";
import { withRequestBudget } from "./request-budget";

const clientFor = (
   handle: (request: {
      method: string;
      body?: unknown;
   }) => Promise<FixtureReply>,
   region = "us-east-1"
) =>
   s3Fixture(handle, {
      endpoint: "https://storage.example.com",
      region,
      maxAttempts: 2,
   }).client;

afterEach(() => vi.restoreAllMocks());

describe("createNewBucket", () => {
   it("rejects an existing bucket without sending CreateBucket", async () => {
      const handle = vi.fn(async (_request: { method: string }) => empty(200));
      await expect(
         createNewBucket(
            clientFor(handle),
            Provider.S3,
            "existing-bucket",
            new AbortController().signal
         )
      ).rejects.toMatchObject({ status: 409 });
      expect(handle.mock.calls).toHaveLength(1);
      expect(handle.mock.calls[0]?.[0]).toMatchObject({ method: "HEAD" });
   });

   it("never retries a lost CreateBucket response, and a user retry checks existence again", async () => {
      let exists = false;
      const methods: string[] = [];
      const handle = vi.fn(async (request: { method: string }) => {
         methods.push(request.method);
         if (request.method === "HEAD") return empty(exists ? 200 : 404);
         exists = true;
         throw Object.assign(new Error("Response connection lost"), {
            code: "ECONNRESET",
         });
      });
      const client = clientFor(handle);
      const create = () =>
         createNewBucket(
            client,
            Provider.S3,
            "new-bucket",
            new AbortController().signal
         );
      await expect(create()).rejects.toMatchObject({ status: 502 });
      expect(methods).toEqual(["HEAD", "PUT"]);
      await expect(create()).rejects.toMatchObject({ status: 409 });
      expect(methods).toEqual(["HEAD", "PUT", "HEAD"]);
      expect(await client.config.maxAttempts()).toBe(2);
   });

   it("fails closed when bucket existence cannot be checked", async () => {
      const handle = vi.fn(async () => empty(403));
      await expect(
         createNewBucket(
            clientFor(handle),
            Provider.S3,
            "unknown-bucket",
            new AbortController().signal
         )
      ).rejects.toMatchObject({ status: 403 });
      expect(handle).toHaveBeenCalledTimes(1);
   });

   it.each([403, 301])(
      "reports a name AWS holds elsewhere as already existing (%i with a bucket region)",
      async (status) => {
         const handle = vi.fn(async () =>
            empty(status, { "x-amz-bucket-region": "eu-west-1" })
         );
         await expect(
            createNewBucket(
               clientFor(handle),
               Provider.S3,
               "photos",
               new AbortController().signal
            )
         ).rejects.toMatchObject({
            status: 409,
            message: "photos already exists",
         });
         expect(handle).toHaveBeenCalledTimes(1);
      }
   );

   it("does not read a bucket region from another provider as proof the bucket exists", async () => {
      const handle = vi.fn(async () =>
         empty(403, { "x-amz-bucket-region": "eu-west-1" })
      );
      await expect(
         createNewBucket(
            clientFor(handle),
            Provider.Other,
            "photos",
            new AbortController().signal
         )
      ).rejects.toMatchObject({ status: 403 });
      expect(handle).toHaveBeenCalledTimes(1);
   });

   it("reports an existing-bucket conflict instead of treating it as a successful create", async () => {
      const handle = vi.fn(async (request: { method: string }) =>
         request.method === "HEAD"
            ? empty(404)
            : reply(
                 409,
                 "<Error><Code>BucketAlreadyOwnedByYou</Code><Message>Already owned</Message></Error>"
              )
      );
      await expect(
         createNewBucket(
            clientFor(handle),
            Provider.S3,
            "new-bucket",
            new AbortController().signal
         )
      ).rejects.toMatchObject({ status: 409 });
      expect(handle).toHaveBeenCalledTimes(2);
   });

   it.each([
      [403, "AccessDenied", true],
      [409, "BucketAlreadyExists", true],
      [400, "RequestTimeout", false],
      [408, "RequestTimeout", false],
      [500, "InternalError", false],
   ])(
      "settles only definitive create rejections (%i, %s)",
      async (status, code, settled) => {
         const lifecycle = {
            submitted: vi.fn(async () => {}),
            settled: vi.fn(),
         };
         const handle = vi.fn(async (request: { method: string }) =>
            request.method === "HEAD"
               ? empty(404)
               : reply(status, errorXml(code))
         );
         await expect(
            createNewBucket(
               clientFor(handle),
               Provider.S3,
               "new-bucket",
               new AbortController().signal,
               lifecycle
            )
         ).rejects.toBeDefined();
         expect(lifecycle.submitted).toHaveBeenCalledOnce();
         expect(lifecycle.settled).toHaveBeenCalledTimes(settled ? 1 : 0);
      }
   );

   it("settles a create refused before it was sent", async () => {
      const lifecycle = { submitted: vi.fn(async () => {}), settled: vi.fn() };
      const handle = vi.fn(async () => empty(404));
      const held = installReadBudget(1_000_000, {
         total: 1,
         user: 1,
         server: 1,
      }).acquire({ serverId: "other" });
      try {
         await expect(
            createNewBucket(
               withRequestBudget(clientFor(handle), "busy-create"),
               Provider.S3,
               "new-bucket",
               new AbortController().signal,
               lifecycle
            )
         ).rejects.toMatchObject({ status: 429 });
      } finally {
         held.release();
      }
      expect(handle).toHaveBeenCalledOnce();
      expect(lifecycle.settled).toHaveBeenCalledOnce();
   });

   it("creates a new regional bucket with the required location constraint", async () => {
      const handle = vi.fn(
         async (request: { method: string; body?: unknown }) =>
            request.method === "HEAD" ? empty(404) : empty(200)
      );
      await createNewBucket(
         clientFor(handle, "eu-west-1"),
         Provider.S3,
         "new-bucket",
         new AbortController().signal
      );
      expect(handle.mock.calls[1]?.[0].body).toContain(
         "<LocationConstraint>eu-west-1</LocationConstraint>"
      );
   });
});
