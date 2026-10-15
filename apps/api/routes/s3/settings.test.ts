import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { S3_ROUTE_TIMEOUT_MS, copyWorkMs } from "@/lib/constants";
import { errorHandler } from "@/lib/http";
import {
   bucketMember,
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import { endpointStub } from "@/lib/testing/s3-fixture";
import { GIB } from "@s3-viewer/types";
import { settingsRouter } from "./settings";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "VIEWER" | null,
   getClient: vi.fn(),
   head: vi.fn(),
   copy: vi.fn(),
   audit: vi.fn(),
   send: vi.fn(),
   requestSignal: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: { $queryRaw: scopeQueryRaw(() => bucketMember(state.role)) },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/copy", () => ({ copyObject: state.copy }));
vi.mock("@/lib/s3/object-metadata", () => ({ headReviewed: state.head }));
vi.mock("@/lib/http", async (original) => {
   const actual = await original<typeof import("@/lib/http")>();
   state.requestSignal.mockImplementation(actual.requestSignal);
   return { ...actual, requestSignal: state.requestSignal };
});
vi.mock("@/lib/s3/no-retry", () => ({
   withoutRetries: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
}));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.audit,
   recordMany: vi.fn(),
}));

const awsClient = endpointStub(state.send);

const HEAD_OUTPUT = {
   ContentType: "text/csv",
   ContentLength: 42,
   LastModified: new Date("2026-01-02T03:04:05.000Z"),
   StorageClass: "STANDARD",
   ETag: '"reviewed"',
   CacheControl: "max-age=60",
   ContentDisposition: 'attachment; filename="q3.csv"',
   ContentEncoding: "identity",
   ContentLanguage: "en-GB",
   Expires: new Date("2026-10-21T07:28:00.000Z"),
   Metadata: { owner: "finance" },
   ServerSideEncryption: "AES256",
   SSEKMSKeyId: undefined,
   VersionId: "v1",
};

let base: string;
routeServer(
   (app) => {
      app.use(express.json({ limit: "1mb" }));
      app.use((req, _res, next) => {
         req.headers["sec-fetch-site"] ??= "same-origin";
         next();
      });
      app.use(signedIn(() => ({ id: state.actor })));
      app.use("/servers/:serverId/buckets/:bucketName/objects", settingsRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/buckets/backups/objects/v3/settings`;
   }
);
beforeEach(() => {
   state.actor = "actor12345";
   state.role = "OWNER";
   state.requestSignal.mockClear();
   state.getClient.mockReset().mockResolvedValue(awsClient);
   state.audit.mockReset().mockResolvedValue(undefined);
   state.head.mockReset().mockResolvedValue(HEAD_OUTPUT);
   state.copy.mockReset().mockResolvedValue({ eTag: '"written"', size: 42 });
   state.send.mockReset().mockResolvedValue(HEAD_OUTPUT);
});

const body = (overrides: Record<string, unknown> = {}) => ({
   expectedUserId: state.actor,
   objectKey: "reports/q3.csv",
   expectedETag: '"reviewed"',
   contentType: "text/csv",
   metadata: { owner: "finance" },
   ...overrides,
});

const patch = (overrides: Record<string, unknown> = {}) =>
   fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body(overrides)),
   });

const expectNoStorage = () => {
   expect(state.getClient).not.toHaveBeenCalled();
   expect(state.copy).not.toHaveBeenCalled();
   expect(state.audit).not.toHaveBeenCalled();
};

describe("reading object settings", () => {
   it("returns every stored header and the user metadata", async () => {
      const response = await fetch(
         `${base}?objectKey=${encodeURIComponent("reports/q3.csv")}`
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
         contentType: "text/csv",
         contentLength: 42,
         lastModified: "2026-01-02T03:04:05.000Z",
         storageClass: "STANDARD",
         eTag: '"reviewed"',
         cacheControl: "max-age=60",
         contentDisposition: 'attachment; filename="q3.csv"',
         contentEncoding: "identity",
         contentLanguage: "en-GB",
         expires: "2026-10-21T07:28:00.000Z",
         metadata: { owner: "finance" },
         serverSideEncryption: "AES256",
         sseKmsKeyId: null,
         versionId: "v1",
      });
   });

   it("withholds user metadata, version and encryption details from a viewer", async () => {
      state.role = "VIEWER";
      state.send.mockResolvedValue({
         ...HEAD_OUTPUT,
         ServerSideEncryption: "aws:kms",
         SSEKMSKeyId: "arn:aws:kms:us-east-1:123456789012:key/abc",
      });
      const response = await fetch(
         `${base}?objectKey=${encodeURIComponent("reports/q3.csv")}`
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
         contentType: "text/csv",
         contentLength: 42,
         lastModified: "2026-01-02T03:04:05.000Z",
         storageClass: "STANDARD",
         eTag: '"reviewed"',
         cacheControl: null,
         contentDisposition: null,
         contentEncoding: "identity",
         contentLanguage: null,
         expires: null,
         metadata: {},
         serverSideEncryption: null,
         sseKmsKeyId: null,
         versionId: null,
      });
   });

   it("records the read like a preview of the same object", async () => {
      const response = await fetch(
         `${base}?objectKey=${encodeURIComponent("reports/q3.csv")}`
      );
      expect(response.status).toBe(200);
      expect(state.audit).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
         action: "object.view",
         bucket: "backups",
         target: "reports/q3.csv",
         detail: { size: 42, contentType: "text/csv" },
      });
   });

   it("refuses a cross-site read before it can write an audit row", async () => {
      const response = await fetch(`${base}?objectKey=report.json`, {
         headers: { "sec-fetch-site": "cross-site" },
      });
      expect(response.status).toBe(403);
      expectNoStorage();
   });

   it("records nothing when the object is missing", async () => {
      state.send.mockRejectedValue(
         Object.assign(new Error("Not Found"), {
            name: "NotFound",
            $metadata: { httpStatusCode: 404 },
         })
      );
      const response = await fetch(`${base}?objectKey=gone.csv`);
      expect(response.status).toBe(404);
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("refuses a folder key", async () => {
      const response = await fetch(`${base}?objectKey=reports%2F`);
      expect(response.status).toBe(400);
      expectNoStorage();
   });

   it("needs a member with download access", async () => {
      state.role = null;
      const response = await fetch(`${base}?objectKey=report.json`);
      expect(response.status).toBe(404);
      expectNoStorage();
   });
});

describe("writing object settings", () => {
   it("self-copies with the replacement settings and audits the change", async () => {
      const response = await patch({
         cacheControl: "max-age=120",
         contentDisposition: "inline",
         contentLanguage: "en",
         contentEncoding: "",
         expires: "2027-01-01T00:00:00.000Z",
         metadata: { owner: "finance", team: "reporting" },
      });
      expect(response.status).toBe(200);
      expect(state.head).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "reports/q3.csv",
         '"reviewed"'
      );
      expect(state.copy).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "S3",
         expect.objectContaining({
            sourceKey: "reports/q3.csv",
            destinationKey: "reports/q3.csv",
            sourceETag: '"reviewed"',
            settings: {
               ContentType: "text/csv",
               CacheControl: "max-age=120",
               ContentDisposition: "inline",
               ContentLanguage: "en",
               Expires: new Date("2027-01-01T00:00:00.000Z"),
               Metadata: { owner: "finance", team: "reporting" },
            },
         })
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.settings",
            bucket: "backups",
            target: "reports/q3.csv",
            detail: { contentType: "text/csv" },
         })
      );
   });

   it("gives the rewrite of a large object a deadline sized to it", async () => {
      state.head.mockResolvedValue({ ...HEAD_OUTPUT, ContentLength: 10 * GIB });
      const response = await patch();
      expect(response.status).toBe(200);
      const deadline = copyWorkMs(10 * GIB);
      expect(deadline).toBeGreaterThan(S3_ROUTE_TIMEOUT_MS);
      expect(state.requestSignal).toHaveBeenLastCalledWith(
         expect.anything(),
         deadline
      );
      const { signal } = state.copy.mock.calls[0]![0] as {
         signal: AbortSignal;
      };
      expect(signal).toBe(state.requestSignal.mock.results.at(-1)!.value);
   });

   it("answers from the committed rewrite without reading storage again", async () => {
      state.send.mockRejectedValue(new Error("storage unreachable"));
      const response = await patch({ cacheControl: "", contentLanguage: "fr" });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
         contentType: "text/csv",
         contentLength: 42,
         eTag: '"written"',
         cacheControl: null,
         contentLanguage: "fr",
         metadata: { owner: "finance" },
         storageClass: "STANDARD",
         versionId: null,
      });
      expect(state.send).not.toHaveBeenCalled();
   });

   it.each([
      ["a missing ETag", { expectedETag: undefined }],
      ["a wildcard ETag", { expectedETag: '"*"' }],
      ["a folder key", { objectKey: "reports/" }],
      ["an invalid content type", { contentType: "not a media type" }],
      ["an uppercase metadata name", { metadata: { "Owner Name": "x" } }],
      [
         "too many metadata entries",
         {
            metadata: Object.fromEntries(
               Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"])
            ),
         },
      ],
      [
         "an oversized metadata value",
         { metadata: { owner: "x".repeat(1025) } },
      ],
      [
         "metadata over the total budget",
         {
            metadata: Object.fromEntries(
               Array.from({ length: 4 }, (_, i) => [`k${i}`, "x".repeat(600)])
            ),
         },
      ],
      ["a header with a newline", { cacheControl: "max-age=60\nx: y" }],
   ])("refuses %s", async (_name, overrides) => {
      expect((await patch(overrides)).status).toBe(400);
      expectNoStorage();
   });

   it("refuses a stale signed-in account", async () => {
      const response = await patch({ expectedUserId: "someoneelse1" });
      expect(response.status).toBe(403);
      expect(state.copy).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("refuses a member who can only read", async () => {
      state.role = "VIEWER";
      const response = await patch();
      expect(response.status).toBe(403);
      expectNoStorage();
   });
});
