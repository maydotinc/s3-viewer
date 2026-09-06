import { S3Client } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createNewBucket } from "./bucket-create";

const response = (statusCode: number, body = "") => ({
   response: {
      statusCode,
      headers: { "content-type": "application/xml" },
      body: Readable.from([body]),
   },
});

const clientFor = (
   handle: (request: {
      method: string;
      body?: unknown;
   }) => Promise<ReturnType<typeof response>>,
   region = "us-east-1"
) =>
   new S3Client({
      region,
      endpoint: "https://storage.example.com",
      credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
      forcePathStyle: true,
      maxAttempts: 2,
      requestHandler: { handle },
   });

describe("createNewBucket", () => {
   it("rejects an existing bucket without sending CreateBucket", async () => {
      const handle = vi.fn(async (_request: { method: string }) =>
         response(200)
      );
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
         if (request.method === "HEAD") return response(exists ? 200 : 404);
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
      const handle = vi.fn(async () => response(403));
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

   it("reports an existing-bucket conflict instead of treating it as a successful create", async () => {
      const handle = vi.fn(async (request: { method: string }) =>
         request.method === "HEAD"
            ? response(404)
            : response(
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

   it("creates a new regional bucket with the required location constraint", async () => {
      const handle = vi.fn(
         async (request: { method: string; body?: unknown }) =>
            request.method === "HEAD" ? response(404) : response(200)
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
