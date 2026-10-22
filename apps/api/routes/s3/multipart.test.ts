import { S3_ROUTE_TIMEOUT_MS, copyDeadlineMs } from "@/lib/constants";
import { env } from "@/lib/env";
import { errorHandler } from "@/lib/http";
import express from "express";
import { IncomingMessage, request as httpRequest } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_MULTIPART_PARTS, MAX_OBJECT_BYTES } from "@s3-viewer/types";
import {
   bucketMember,
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import { endpointStub } from "@/lib/testing/s3-fixture";
import { UnconfirmedWriteError } from "@/lib/s3/conditions";
import { sealUploadId } from "@/lib/s3/multipart-uploads";
import { multipartRouter } from "./multipart";

const seal = (
   uploadId: string,
   partSize: number,
   binding = { serverId: "server12345", bucket: "backups", key: "videos/a.mp4" }
): string => {
   const sealed = sealUploadId(uploadId, partSize, binding);
   if (!sealed) throw new Error("expected a sealed upload id");
   return sealed;
};

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "EDITOR" | "VIEWER" | null,
   getClient: vi.fn(),
   list: vi.fn(),
   abort: vi.fn(),
   part: vi.fn(),
   complete: vi.fn(),
   audit: vi.fn(),
   auditMany: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: { $queryRaw: scopeQueryRaw(() => bucketMember(state.role)) },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/no-retry", () => ({
   forCancel: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
   withoutRetries: (client: unknown) => client,
}));
vi.mock("@/lib/s3/multipart-uploads", async (original) => {
   const actual = await original<typeof import("@/lib/s3/multipart-uploads")>();
   state.complete.mockImplementation(actual.completeUpload);
   return {
      ...actual,
      completeUpload: state.complete,
      listMultipartUploads: state.list,
      abortMultipartUploads: state.abort,
      streamPart: state.part,
   };
});
vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.audit,
   recordMany: state.auditMany,
}));

const client = endpointStub(vi.fn());
const upload = { key: "videos/a.mp4", uploadId: "u1" };

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn(() => ({ id: state.actor })));
      app.use(
         "/servers/:serverId/buckets/:bucketName/objects",
         multipartRouter
      );
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/buckets/backups/objects/v3/multipart-uploads`;
   }
);
beforeEach(() => {
   state.role = "OWNER";
   client.send.mockReset().mockResolvedValue({});
   state.getClient.mockReset().mockResolvedValue(client);
   state.audit.mockReset().mockResolvedValue(undefined);
   state.auditMany.mockReset().mockResolvedValue(undefined);
   state.list.mockReset().mockResolvedValue({
      uploads: [
         {
            ...upload,
            initiated: "2026-09-01T10:00:00.000Z",
            storageClass: "STANDARD",
         },
      ],
      nextKeyMarker: null,
      nextUploadIdMarker: null,
   });
   state.abort
      .mockReset()
      .mockResolvedValue({ aborted: [upload], alreadyGone: [], failed: [] });
   state.part
      .mockReset()
      .mockResolvedValue({ partNumber: 1, eTag: '"e"', size: 1024 });
});

const remove = (body: Record<string, unknown>) =>
   fetch(base, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
   });

const MIB = 1024 * 1024;

const putPart = (
   uploadId: string,
   contentLength: number,
   body?: Buffer,
   partNumber = 1,
   contentType = "application/octet-stream"
): Promise<{ status: number; body: string }> =>
   new Promise((resolve, reject) => {
      const request = httpRequest(
         new URL(
            `${base}/parts?objectKey=videos%2Fa.mp4&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}&expectedUserId=${state.actor}`
         ),
         {
            method: "PUT",
            headers: {
               "content-type": contentType,
               "content-length": String(contentLength),
            },
         },
         (res) => {
            let received = "";
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => (received += chunk));
            res.on("end", () =>
               resolve({ status: res.statusCode ?? 0, body: received })
            );
         }
      );
      request.on("error", reject);
      if (body) request.end(body);
      else request.flushHeaders();
   });

describe("uploading a part", () => {
   it("refuses an upload id stripped of its plan instead of guessing a part cap", async () => {
      const response = await putPart("u1", 1024);
      expect(response.status).toBe(400);
      expect(JSON.parse(response.body).message).toMatch(
         /Start the upload again/
      );
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.part).not.toHaveBeenCalled();
   });

   it("refuses a part that is not sent as application/octet-stream", async () => {
      const response = await putPart(
         seal("u1", MIB),
         1024,
         undefined,
         1,
         "text/plain"
      );
      expect(response.status).toBe(415);
      expect(JSON.parse(response.body).message).toBe(
         "Parts must be sent as application/octet-stream"
      );
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.part).not.toHaveBeenCalled();
   });

   it("refuses a part larger than this upload's own plan", async () => {
      const response = await putPart(seal("u1", MIB), 2 * MIB);
      expect(response.status).toBe(413);
      expect(JSON.parse(response.body).message).toBe(
         "Parts are limited to 1048576 bytes"
      );
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.part).not.toHaveBeenCalled();
   });

   it("takes a part within the plan and sends storage its own upload id", async () => {
      const response = await putPart(
         seal("u1", MIB),
         1024,
         Buffer.alloc(1024, 7)
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ partNumber: 1 });
      expect(state.part).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         expect.objectContaining({ uploadId: "u1", contentLength: 1024 })
      );
   });

   it("takes the last part number an upload at the size cap can need and refuses the next", async () => {
      const lastPart = Math.ceil(
         Math.min(env.MAX_UPLOAD_BYTES, MAX_OBJECT_BYTES) / MIB
      );
      expect(lastPart).toBeLessThan(MAX_MULTIPART_PARTS);
      const accepted = await putPart(
         seal("u1", MIB),
         1024,
         Buffer.alloc(1024, 7),
         lastPart
      );
      expect(accepted.status).toBe(200);
      expect(state.part).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({ partNumber: lastPart })
      );
      state.part.mockClear();
      state.getClient.mockClear();
      const refused = await putPart(
         seal("u1", MIB),
         1024,
         undefined,
         lastPart + 1
      );
      expect(refused.status).toBe(413);
      expect(JSON.parse(refused.body).message).toBe(
         `Uploads are limited to ${Math.min(env.MAX_UPLOAD_BYTES, MAX_OBJECT_BYTES)} bytes`
      );
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.part).not.toHaveBeenCalled();
   });

   it.each([
      ["another key", { key: "videos/other.mp4" }],
      ["another bucket", { bucket: "elsewhere" }],
      ["another server", { serverId: "server67890" }],
   ])("refuses an upload id issued for %s", async (_what, other) => {
      const issued = seal("u1", MIB, {
         serverId: "server12345",
         bucket: "backups",
         key: "videos/a.mp4",
         ...other,
      });
      const response = await putPart(issued, 1024);
      expect(response.status).toBe(400);
      expect(state.part).not.toHaveBeenCalled();
   });
});

describe("listing incomplete uploads", () => {
   it("returns the page and forwards the paging markers", async () => {
      const response = await fetch(
         `${base}?prefix=videos%2F&keyMarker=videos%2Fa.mp4&uploadIdMarker=u0`
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
         uploads: [expect.objectContaining({ uploadId: "u1" })],
         nextKeyMarker: null,
      });
      expect(state.list).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "server12345",
         {
            prefix: "videos/",
            keyMarker: "videos/a.mp4",
            uploadIdMarker: "u0",
         }
      );
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("defaults to the whole bucket", async () => {
      expect((await fetch(base)).status).toBe(200);
      expect(state.list.mock.calls[0]?.[2]).toEqual({
         prefix: "",
         keyMarker: undefined,
         uploadIdMarker: undefined,
      });
   });

   it("lets an editor list but keeps a viewer and a removed member out", async () => {
      state.role = "EDITOR";
      expect((await fetch(base)).status).toBe(200);
      state.role = "VIEWER";
      expect((await fetch(base)).status).toBe(403);
      state.role = null;
      expect((await fetch(base)).status).toBe(404);
      expect(state.list).toHaveBeenCalledTimes(1);
   });
});

describe("completing a multipart upload", () => {
   it("keeps the signed plan through the route and publishes with its original condition", async () => {
      client.send
         .mockResolvedValueOnce({
            Parts: [{ PartNumber: 1, ETag: '"part"', Size: 1024 }],
         })
         .mockResolvedValueOnce({ ETag: '"final"' });
      const response = await fetch(`${base}/complete`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objectKey: upload.key,
            uploadId: seal("u1", MIB),
            parts: [{ partNumber: 1, eTag: '"part"' }],
         }),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
         size: 1024,
         eTag: '"final"',
      });
      expect(client.send.mock.calls[1]?.[0].input).toMatchObject({
         UploadId: "u1",
         IfNoneMatch: "*",
      });
      expect(state.audit).toHaveBeenCalledOnce();
   });
});

describe("a multipart completion cut off after storage received it", () => {
   it("audits the upload as unconfirmed", async () => {
      state.complete.mockRejectedValueOnce(new UnconfirmedWriteError());
      const response = await fetch(`${base}/complete`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objectKey: upload.key,
            uploadId: seal("u1", MIB),
            parts: [{ partNumber: 1, eTag: '"part"' }],
         }),
      });
      expect(response.status).toBe(502);
      expect(state.audit.mock.calls.map(([, entry]) => entry)).toEqual([
         {
            action: "object.upload",
            bucket: "backups",
            target: upload.key,
            detail: { parts: 1, replaced: false, confirmed: false },
         },
      ]);
   });
});

describe("the deadline for publishing a multipart upload", () => {
   it("scales with the stored size and outlives the idle socket timeout", async () => {
      const size = 4 * 1024 * MIB;
      const timeout = vi.spyOn(AbortSignal, "timeout");
      const idle = vi.spyOn(IncomingMessage.prototype, "setTimeout");
      try {
         client.send
            .mockResolvedValueOnce({
               Parts: [{ PartNumber: 1, ETag: '"part"', Size: size }],
            })
            .mockResolvedValueOnce({ ETag: '"final"' });
         const response = await fetch(`${base}/complete`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
               expectedUserId: state.actor,
               objectKey: upload.key,
               uploadId: seal("u1", MIB),
               parts: [{ partNumber: 1, eTag: '"part"' }],
            }),
         });
         expect(response.status).toBe(201);
         expect(copyDeadlineMs(size)).toBeGreaterThan(S3_ROUTE_TIMEOUT_MS);
         expect(timeout.mock.calls.map(([ms]) => ms)).toContain(
            copyDeadlineMs(size)
         );
         const [listing, commit] = client.send.mock.calls.map(
            ([, options]) =>
               (options as { abortSignal: AbortSignal }).abortSignal
         );
         expect(commit).not.toBe(listing);
         expect(commit?.aborted).toBe(false);
         expect(idle).toHaveBeenCalledWith(0);
      } finally {
         timeout.mockRestore();
         idle.mockRestore();
      }
   });
});

describe("aborting incomplete uploads", () => {
   it("aborts and records one row per key, sharing the batch", async () => {
      const other = { key: "videos/b.mp4", uploadId: "u2" };
      state.abort.mockResolvedValue({
         aborted: [upload, other],
         alreadyGone: [],
         failed: [],
      });
      const response = await remove({
         expectedUserId: state.actor,
         uploads: [upload, other],
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
         aborted: [upload, other],
         failed: [],
      });
      expect(state.abort).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "server12345",
         [upload, other]
      );
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [upload, other].map(({ key }) => ({
            action: "object.multipart_abort",
            bucket: "backups",
            target: key,
            detail: { batch: null, count: 2 },
         }))
      );
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("reports partial failure as 207", async () => {
      state.abort.mockResolvedValue({
         aborted: [upload],
         alreadyGone: [],
         failed: [{ key: "videos/b.mp4", uploadId: "u2", message: "denied" }],
      });
      const response = await remove({
         expectedUserId: state.actor,
         uploads: [upload, { key: "videos/b.mp4", uploadId: "u2" }],
      });
      expect(response.status).toBe(207);
      expect(await response.json()).toMatchObject({
         failed: [{ uploadId: "u2" }],
      });
   });

   it("records nothing when every abort failed", async () => {
      state.abort.mockResolvedValue({
         aborted: [],
         alreadyGone: [],
         failed: [{ ...upload, message: "denied" }],
      });
      const response = await remove({
         expectedUserId: state.actor,
         uploads: [upload],
      });
      expect(response.status).toBe(207);
      expect(state.auditMany).not.toHaveBeenCalled();
   });

   it("lists uploads already gone as aborted without auditing them", async () => {
      const gone = { key: "videos/b.mp4", uploadId: "u2" };
      state.abort.mockResolvedValue({
         aborted: [upload],
         alreadyGone: [gone],
         failed: [],
      });
      const response = await remove({
         expectedUserId: state.actor,
         uploads: [upload, gone],
      });
      expect(await response.json()).toEqual({
         aborted: [upload, gone],
         failed: [],
      });
      expect(state.auditMany).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         [expect.objectContaining({ target: upload.key })]
      );
   });

   it.each([
      ["a changed account", { expectedUserId: "other12345" }, 403],
      ["no initiating user", {}, 400],
      ["an empty list", { expectedUserId: "actor12345", uploads: [] }, 400],
      [
         "a repeated upload id",
         {
            expectedUserId: "actor12345",
            uploads: [upload, { key: "videos/b.mp4", uploadId: "u1" }],
         },
         400,
      ],
   ])("rejects %s before storage work", async (_name, body, status) => {
      const response = await remove({ uploads: [upload], ...body });
      expect(response.status).toBe(status);
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.abort).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("keeps a viewer out and a removed member out", async () => {
      state.role = "VIEWER";
      expect(
         (await remove({ expectedUserId: state.actor, uploads: [upload] }))
            .status
      ).toBe(403);
      state.role = null;
      expect(
         (await remove({ expectedUserId: state.actor, uploads: [upload] }))
            .status
      ).toBe(404);
      expect(state.abort).not.toHaveBeenCalled();
   });
});

describe("an upload id issued for another key", () => {
   const foreign = () =>
      encodeURIComponent(
         seal("u1", MIB, {
            serverId: "server12345",
            bucket: "backups",
            key: "videos/other.mp4",
         })
      );

   it("can't be used to list that upload's parts", async () => {
      const response = await fetch(
         `${base}/parts?objectKey=videos%2Fa.mp4&uploadId=${foreign()}`
      );
      expect(response.status).toBe(400);
      expect(client.send).not.toHaveBeenCalled();
   });

   it("can't be used to cancel or publish that upload", async () => {
      for (const [path, method, extra] of [
         ["upload", "DELETE", {}],
         ["complete", "POST", { parts: [{ partNumber: 1, eTag: '"part"' }] }],
      ] as const) {
         const response = await fetch(`${base}/${path}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
               expectedUserId: state.actor,
               objectKey: upload.key,
               uploadId: decodeURIComponent(foreign()),
               ...extra,
            }),
         });
         expect(response.status).toBe(400);
      }
      expect(client.send).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
   });
});

describe("canceling the current multipart upload", () => {
   const cancel = () =>
      fetch(`${base}/upload`, {
         method: "DELETE",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objectKey: upload.key,
            uploadId: seal("u1", MIB),
         }),
      });

   it.each([
      [{ name: "AccessDenied", $metadata: { httpStatusCode: 403 } }, 403],
      [{ name: "TimeoutError" }, 502],
   ])(
      "returns an explicit storage failure without a successful audit",
      async (error, status) => {
         client.send.mockRejectedValue(error);
         const response = await cancel();
         expect(response.status).toBe(status);
         expect(state.audit).not.toHaveBeenCalled();
      }
   );

   it("audits a confirmed cancellation", async () => {
      expect((await cancel()).status).toBe(204);
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({ action: "object.multipart_abort" })
      );
   });

   it("answers an already absent upload without an audit", async () => {
      client.send.mockRejectedValue({
         name: "NoSuchUpload",
         $metadata: { httpStatusCode: 404 },
      });
      expect((await cancel()).status).toBe(204);
      expect(state.audit).not.toHaveBeenCalled();
   });
});
