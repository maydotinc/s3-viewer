import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GIB, MAX_BATCH_KEYS } from "@s3-viewer/types";
import { S3_ROUTE_TIMEOUT_MS, copyWorkMs } from "@/lib/constants";
import { errorHandler } from "@/lib/http";
import { isObjectUpload } from "@/lib/middleware/upload-body";
import { UnconfirmedWriteError } from "@/lib/s3/conditions";
import { PartialRenameError } from "@/lib/s3/rename";
import { objectsRouter } from "./objects";
import {
   bucketMember,
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import { endpointStub } from "@/lib/testing/s3-fixture";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "VIEWER" | null,
   getClient: vi.fn(),
   upload: vi.fn(),
   remove: vi.fn(),
   rename: vi.fn(),
   move: vi.fn(),
   partial: vi.fn(),
   unconfirmed: vi.fn(),
   head: vi.fn(),
   copy: vi.fn(),
   folder: vi.fn(),
   audit: vi.fn(),
   auditMany: vi.fn(),
   list: vi.fn(),
   listKeys: vi.fn(),
   presign: vi.fn(),
   send: vi.fn(),
   requestSignal: vi.fn(),
   authorizeRead: vi.fn(),
   responseClosed: vi.fn(),
   idleTimeoutMs: 0,
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $queryRaw: async (
         strings: TemplateStringsArray,
         ...values: unknown[]
      ) => {
         await state.authorizeRead();
         return scopeQueryRaw(() => bucketMember(state.role))(
            strings,
            ...values
         );
      },
   },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/upload", async (original) => ({
   ...(await original<typeof import("@/lib/s3/upload")>()),
   streamUpload: state.upload,
}));
vi.mock("@/lib/s3/delete", () => ({ deleteKeys: state.remove }));
vi.mock("@/lib/s3/listing", () => ({
   listPage: state.list,
   listKeysPage: state.listKeys,
}));
vi.mock("@/lib/s3/presign", () => ({ presignedUrl: state.presign }));
vi.mock("@/lib/s3/rename", async (original) => ({
   ...(await original<typeof import("@/lib/s3/rename")>()),
   renameObject: state.rename,
   moveObjects: state.move,
   partialCopies: state.partial,
   unconfirmedCopies: state.unconfirmed,
}));
vi.mock("@/lib/s3/object-metadata", () => ({ headReviewed: state.head }));
vi.mock("@/lib/http", async (original) => {
   const actual = await original<typeof import("@/lib/http")>();
   state.requestSignal.mockImplementation(actual.requestSignal);
   return { ...actual, requestSignal: state.requestSignal };
});
vi.mock("@/lib/s3/copy", () => ({
   copyObject: state.copy,
   createFolder: state.folder,
}));
vi.mock("@/lib/s3/no-retry", () => ({
   withoutRetries: (client: unknown) => client,
   withoutBudget: (client: unknown) => client,
   forCleanup: (client: unknown) => client,
}));
vi.mock("@/lib/middleware/audit-record", () => ({
   record: state.audit,
   recordMany: state.auditMany,
}));

const awsClient = endpointStub(state.send, "s3.us-east-1.amazonaws.com");

let base: string;
routeServer(
   (app) => {
      app.use((req, res, next) => {
         res.once("close", () => state.responseClosed());
         req.headers["sec-fetch-site"] = "same-origin";
         if (state.idleTimeoutMs) req.setTimeout(state.idleTimeoutMs);
         next();
      });
      const json = express.json({ limit: "1mb" });
      app.use((req, res, next) =>
         isObjectUpload(req) ? next() : json(req, res, next)
      );
      app.use(signedIn(() => ({ id: state.actor })));
      app.use("/servers/:serverId/buckets/:bucketName/objects", objectsRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/server12345/buckets/backups/objects`;
   }
);
beforeEach(() => {
   state.actor = "actor12345";
   state.role = "OWNER";
   state.idleTimeoutMs = 0;
   state.requestSignal.mockClear();
   state.authorizeRead.mockReset().mockResolvedValue(undefined);
   state.responseClosed.mockReset();
   state.getClient.mockReset().mockResolvedValue(awsClient);
   state.audit.mockReset().mockResolvedValue(undefined);
   state.auditMany.mockReset().mockResolvedValue(undefined);
   state.list.mockReset().mockResolvedValue({ objects: [], folders: [] });
   state.listKeys.mockReset().mockResolvedValue({ keys: [] });
   state.presign.mockReset().mockResolvedValue({ url: "https://signed" });
   state.send
      .mockReset()
      .mockResolvedValue({ ContentType: "image/png", ContentLength: 12 });
   state.remove.mockReset().mockResolvedValue({
      deleted: ["report.json"],
      alreadyGone: [],
      failed: [],
   });
   state.rename.mockReset().mockResolvedValue(undefined);
   state.move
      .mockReset()
      .mockResolvedValue({ moved: ["report.json"], failed: [] });
   state.partial.mockReset().mockReturnValue([]);
   state.unconfirmed.mockReset().mockReturnValue([]);
   state.head.mockReset().mockResolvedValue({ ContentLength: 4 });
   state.copy.mockReset().mockResolvedValue({ eTag: '"copied"', size: 4 });
   state.folder.mockReset().mockResolvedValue(undefined);
   state.upload.mockReset().mockImplementation(async ({ body }) => {
      let size = 0;
      for await (const chunk of body) size += Buffer.byteLength(chunk);
      return { size, eTag: '"stored"' };
   });
});

describe("storage setup after authorization", () => {
   // mutations reach storage through readScope too, so one route covers reads as well.
   it("does not resolve a storage client after a request disconnected during authorization", async () => {
      let release!: () => void;
      state.authorizeRead.mockImplementationOnce(
         () =>
            new Promise<void>((resolve) => {
               release = resolve;
            })
      );
      const controller = new AbortController();
      const response = fetch(`${base}/v3/folders`, {
         method: "POST",
         signal: controller.signal,
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            folderKey: "folder/",
            expectedUserId: "actor12345",
         }),
      }).catch(() => undefined);
      try {
         await vi.waitFor(() =>
            expect(state.authorizeRead).toHaveBeenCalledOnce()
         );
         controller.abort();
         await response;
         await vi.waitFor(() =>
            expect(state.responseClosed).toHaveBeenCalledOnce()
         );
      } finally {
         release?.();
      }
      await vi.waitFor(() => expect(state.requestSignal).toHaveBeenCalled());
      expect(state.requestSignal.mock.results.at(-1)?.value.aborted).toBe(true);
      expect(state.getClient).not.toHaveBeenCalled();
      expect(state.folder).not.toHaveBeenCalled();
   });
});

const requests = [
   {
      method: "PUT",
      path: "/v3/upload",
      input: { objectKey: "report.json", contentType: "application/json" },
   },
   {
      method: "DELETE",
      path: "/v3",
      input: { objects: [{ key: "report.json", expectedETag: '"reviewed"' }] },
   },
   {
      method: "POST",
      path: "/v3/rename",
      input: {
         objectKey: "report.json",
         newObjectKey: "renamed.json",
         expectedETag: '"reviewed"',
      },
   },
   {
      method: "POST",
      path: "/v3/move",
      input: {
         objects: [
            {
               key: "report.json",
               newKey: "moved/report.json",
               expectedETag: '"reviewed"',
            },
         ],
      },
   },
   {
      method: "POST",
      path: "/v3/copy",
      input: {
         objectKey: "report.json",
         newObjectKey: "copy.json",
         expectedETag: '"reviewed"',
      },
   },
   {
      method: "POST",
      path: "/v3/folders",
      input: { folderKey: "reports/" },
   },
] as const;

const send = (request: (typeof requests)[number], expectedUserId?: string) => {
   const input = {
      ...request.input,
      ...(expectedUserId ? { expectedUserId } : {}),
   };
   const query =
      request.method === "PUT"
         ? `?${new URLSearchParams(input as Record<string, string>)}`
         : "";
   return fetch(`${base}${request.path}${query}`, {
      method: request.method,
      headers: { "content-type": "application/json" },
      body:
         request.method === "PUT" ? '{"backup":true}' : JSON.stringify(input),
   });
};

const expectNoStorage = () => {
   expect(state.getClient).not.toHaveBeenCalled();
   expect(state.upload).not.toHaveBeenCalled();
   expect(state.remove).not.toHaveBeenCalled();
   expect(state.audit).not.toHaveBeenCalled();
   expect(state.auditMany).not.toHaveBeenCalled();
};

describe("versioned object mutation boundaries", () => {
   it("refuses a wildcard ETag for rename before storage work", async () => {
      const response = await fetch(`${base}/v3/rename`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objectKey: "report.json",
            newObjectKey: "renamed.json",
            expectedETag: '"*"',
         }),
      });
      expect(response.status).toBe(400);
      expectNoStorage();
   });

   it.each(requests)(
      "rejects a changed account on $method $path before storage work",
      async (request) => {
         const response = await send(request, "other12345");
         expect(response.status).toBe(403);
         expect(await response.json()).toMatchObject({
            code: "ACCOUNT_CHANGED",
         });
         expectNoStorage();
      }
   );

   it.each(requests)(
      "requires the initiating user on $method $path",
      async (request) => {
         expect((await send(request)).status).toBe(400);
         expectNoStorage();
      }
   );

   it.each(requests)(
      "preserves viewer restrictions on $method $path",
      async (request) => {
         state.role = "VIEWER";
         expect((await send(request, state.actor)).status).toBe(403);
         expectNoStorage();
      }
   );

   const expectedStatus: Record<string, number> = {
      "/v3/upload": 201,
      "/v3": 200,
      "/v3/rename": 204,
      "/v3/move": 200,
      "/v3/copy": 201,
      "/v3/folders": 201,
   };

   it.each(requests)(
      "runs the mutation after authorizing $method $path",
      async (request) => {
         const response = await send(request, state.actor);
         expect(response.status).toBe(expectedStatus[request.path]);
         expect(state.getClient).toHaveBeenCalledOnce();
         if (request.method === "PUT") {
            expect(await response.json()).toMatchObject({
               size: 15,
               eTag: '"stored"',
            });
         } else if (request.method === "DELETE") {
            expect(state.remove.mock.calls[0]?.[1]).toEqual(
               request.input.objects
            );
         }
      }
   );

   it("reports keys that were already gone as deleted without auditing them", async () => {
      state.remove.mockResolvedValue({
         deleted: ["report.json"],
         alreadyGone: ["gone.json"],
         failed: [],
      });
      const response = await send(requests[1], state.actor);
      expect(await response.json()).toEqual({
         deleted: ["report.json", "gone.json"],
         failed: [],
      });
      expect(
         state.auditMany.mock.calls[0]?.[1].map(
            ({ target }: { target: string }) => target
         )
      ).toEqual(["report.json"]);
   });

   it("renames through copy-and-delete and records the audit trail", async () => {
      const response = await send(requests[2], state.actor);
      expect(response.status).toBe(204);
      expect(state.head).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "report.json",
         '"reviewed"'
      );
      expect(state.rename).toHaveBeenCalledWith(
         expect.objectContaining({ bucket: "backups" }),
         "S3",
         {
            objectKey: "report.json",
            newObjectKey: "renamed.json",
            source: { ContentLength: 4 },
            sourceETag: '"reviewed"',
         }
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "object.rename",
            bucket: "backups",
            target: "report.json",
            detail: { to: "renamed.json" },
         })
      );
   });

   it("audits the copy a partial rename left behind", async () => {
      state.rename.mockRejectedValue(new PartialRenameError());
      const response = await send(requests[2], state.actor);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
         message: expect.stringContaining("could not be removed"),
      });
      expect(state.audit.mock.calls.map(([, entry]) => entry)).toEqual([
         {
            action: "object.copy",
            bucket: "backups",
            target: "report.json",
            detail: { to: "renamed.json" },
         },
      ]);
   });

   it.each([
      ["rename", requests[2], "renamed.json"],
      ["copy", requests[4], "copy.json"],
   ] as const)(
      "audits a %s cut off after storage received it as unconfirmed",
      async (_name, request, to) => {
         state.rename.mockRejectedValue(new UnconfirmedWriteError());
         state.copy.mockRejectedValue(new UnconfirmedWriteError());
         const response = await send(request, state.actor);
         expect(response.status).toBe(502);
         expect(state.audit.mock.calls.map(([, entry]) => entry)).toEqual([
            {
               action: "object.copy",
               bucket: "backups",
               target: "report.json",
               detail: { to, confirmed: false },
            },
         ]);
      }
   );

   it("audits nothing for a rename that created no copy", async () => {
      state.rename.mockRejectedValue(new Error("storage failed"));
      const response = await send(requests[2], state.actor);
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(state.audit).not.toHaveBeenCalled();
   });

   it("audits the copies a partial move left behind without changing the response", async () => {
      const result = {
         moved: ["report.json"],
         failed: [
            { key: "stale.json", message: "not removed", retryable: false },
         ],
      };
      state.move.mockResolvedValue(result);
      state.partial.mockReturnValue(["stale.json"]);
      const response = await fetch(`${base}/v3/move`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objects: [
               {
                  key: "report.json",
                  newKey: "moved/report.json",
                  expectedETag: '"reviewed"',
               },
               {
                  key: "stale.json",
                  newKey: "moved/stale.json",
                  expectedETag: '"reviewed"',
               },
            ],
         }),
      });
      expect(response.status).toBe(207);
      expect(await response.json()).toEqual(result);
      expect(state.partial).toHaveBeenCalledWith(result);
      expect(state.auditMany.mock.calls[0]?.[1]).toEqual([
         expect.objectContaining({
            action: "object.move",
            target: "report.json",
            detail: expect.objectContaining({ to: "moved/report.json" }),
         }),
         expect.objectContaining({
            action: "object.copy",
            target: "stale.json",
            detail: expect.objectContaining({ to: "moved/stale.json" }),
         }),
      ]);
   });

   it("audits a move cut off after storage received its copy as unconfirmed", async () => {
      state.move.mockResolvedValue({
         moved: [],
         failed: [{ key: "report.json", message: "unsure", retryable: false }],
      });
      state.unconfirmed.mockReturnValue(["report.json"]);
      const response = await send(requests[3], state.actor);
      expect(response.status).toBe(207);
      expect(state.auditMany.mock.calls[0]?.[1]).toEqual([
         expect.objectContaining({
            action: "object.copy",
            target: "report.json",
            detail: expect.objectContaining({
               to: "moved/report.json",
               confirmed: false,
            }),
         }),
      ]);
   });

   it.each([
      ["rename", requests[2], () => state.rename],
      ["copy", requests[4], () => state.copy],
   ] as const)(
      "gives a large %s a deadline sized to the object, not the route",
      async (_name, request, mutation) => {
         state.head.mockResolvedValue({ ContentLength: 10 * GIB });
         const response = await send(request, state.actor);
         expect(response.status).toBeLessThan(300);
         const deadline = copyWorkMs(10 * GIB);
         expect(deadline).toBeGreaterThan(S3_ROUTE_TIMEOUT_MS);
         expect(state.requestSignal).toHaveBeenLastCalledWith(
            expect.anything(),
            deadline
         );
         const { signal } = mutation().mock.calls[0]![0] as {
            signal: AbortSignal;
         };
         expect(signal).toBe(state.requestSignal.mock.results.at(-1)!.value);
         expect(signal.aborted).toBe(false);
      }
   );

   it("keeps the route timeout for a small copy", async () => {
      await send(requests[4], state.actor);
      expect(state.requestSignal).toHaveBeenLastCalledWith(
         expect.anything(),
         S3_ROUTE_TIMEOUT_MS
      );
   });

   it("runs a bulk move on the disconnect signal alone", async () => {
      const response = await send(requests[3], state.actor);
      expect(response.status).toBe(200);
      const { signal } = state.move.mock.calls[0]![0] as {
         signal: AbortSignal;
      };
      expect(signal.aborted).toBe(false);
      expect(
         state.requestSignal.mock.results.map(({ value }) => value)
      ).not.toContain(signal);
   });

   // rename and copy hand the timeout over through copyScope (scope.test.ts); a bulk move calls awaitStorage itself.
   it("keeps a silent bulk move open past the idle socket timeout", async () => {
      state.idleTimeoutMs = 20;
      state.move.mockImplementation(
         () =>
            new Promise((resolve) =>
               setTimeout(
                  () => resolve({ moved: ["report.json"], failed: [] }),
                  80
               )
            )
      );
      const response = await send(requests[3], state.actor);
      expect(response.status).toBe(200);
      const { signal } = state.move.mock.calls[0]![0] as {
         signal: AbortSignal;
      };
      expect(signal.aborted).toBe(false);
   });

   it("returns the copied object and audits object.copy", async () => {
      const response = await send(requests[4], state.actor);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
         key: "copy.json",
         size: 4,
         eTag: '"copied"',
      });
      expect(state.copy).toHaveBeenCalledWith(
         expect.anything(),
         "S3",
         expect.objectContaining({
            sourceKey: "report.json",
            destinationKey: "copy.json",
            sourceETag: '"reviewed"',
         })
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({ action: "object.copy" })
      );
   });

   it("creates a folder key and audits folder.create", async () => {
      const response = await send(requests[5], state.actor);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ key: "reports/" });
      expect(state.folder).toHaveBeenCalledWith(
         expect.anything(),
         "S3",
         "reports/"
      );
      expect(state.audit).toHaveBeenCalledWith(
         expect.anything(),
         expect.objectContaining({
            action: "folder.create",
            target: "reports/",
         })
      );
   });

   const post = (path: string, body: Record<string, unknown>) =>
      fetch(`${base}${path}`, {
         method: "POST",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({ expectedUserId: state.actor, ...body }),
      });

   it.each([
      ["/v3/rename", { objectKey: "a/", newObjectKey: "b/" }],
      ["/v3/copy", { objectKey: "a/", newObjectKey: "b/" }],
   ])("refuses folder keys on %s", async (path, body) => {
      expect(
         (await post(path, { ...body, expectedETag: '"reviewed"' })).status
      ).toBe(400);
      expectNoStorage();
   });

   it("passes slash-ending objects through conditional moves", async () => {
      const objects = [{ key: "a/", newKey: "b/", expectedETag: '"reviewed"' }];
      expect((await post("/v3/move", { objects })).status).toBe(200);
      expect(state.move).toHaveBeenCalledWith(expect.anything(), "S3", objects);
      expect(state.folder).not.toHaveBeenCalled();
   });

   it.each([
      [
         "duplicate destinations",
         [
            { key: "a.txt", newKey: "c.txt", expectedETag: '"reviewed"' },
            { key: "b.txt", newKey: "c.txt", expectedETag: '"reviewed"' },
         ],
      ],
      [
         "more than MAX_BATCH_KEYS",
         Array.from({ length: MAX_BATCH_KEYS + 1 }, (_, i) => ({
            key: `${i}.txt`,
            newKey: `moved/${i}.txt`,
            expectedETag: '"reviewed"',
         })),
      ],
   ])("refuses a move with %s", async (_name, objects) => {
      expect((await post("/v3/move", { objects })).status).toBe(400);
      expectNoStorage();
   });

   it("accepts a null expectedETag on move", async () => {
      const response = await post("/v3/move", {
         objects: [{ key: "a.txt", newKey: "moved/a.txt", expectedETag: null }],
      });
      expect(response.status).toBe(200);
      expect(state.move.mock.calls[0]?.[2]).toEqual([
         { key: "a.txt", newKey: "moved/a.txt", expectedETag: null },
      ]);
   });

   it("refuses a folder key that does not end in a slash", async () => {
      expect(
         (await post("/v3/folders", { folderKey: "reports/nested" })).status
      ).toBe(400);
      expectNoStorage();
   });

   it("passes a replacement straight through", async () => {
      const response = await fetch(
         `${base}/v3/upload?objectKey=report.json&contentType=text%2Fplain&expectedUserId=${state.actor}&expectedETag=${encodeURIComponent('"reviewed"')}`,
         {
            method: "PUT",
            body: "new-data",
         }
      );
      expect(response.status).toBe(201);
      expect(state.getClient).toHaveBeenCalledExactlyOnceWith(
         expect.objectContaining({ serverId: "server12345" }),
         "backups",
         expect.anything()
      );
      expect(state.upload).toHaveBeenCalledWith(
         expect.objectContaining({ expectedETag: '"reviewed"' })
      );
   });

   it("answers failures with 207 and audits deletions and unconfirmed failures", async () => {
      const failed = [
         {
            key: "stale.json",
            message:
               "The object changed. Refresh and review it before deleting.",
            retryable: false,
         },
         {
            key: "lost.json",
            message:
               "Deletion was not confirmed. Refresh and check this object before trying again.",
            retryable: false,
         },
      ];
      state.remove.mockResolvedValue({
         deleted: ["report.json"],
         alreadyGone: ["gone.json"],
         failed,
      });
      const response = await fetch(`${base}/v3`, {
         method: "DELETE",
         headers: { "content-type": "application/json" },
         body: JSON.stringify({
            expectedUserId: state.actor,
            objects: [
               "report.json",
               "gone.json",
               "stale.json",
               "lost.json",
            ].map((key) => ({ key, expectedETag: '"reviewed"' })),
         }),
      });
      expect(response.status).toBe(207);
      expect(await response.json()).toEqual({
         deleted: ["report.json", "gone.json"],
         failed,
      });
      expect(state.auditMany.mock.calls[0]?.[1]).toEqual([
         {
            action: "object.delete",
            bucket: "backups",
            target: "report.json",
            detail: { batch: null, count: 1 },
         },
         {
            action: "object.delete",
            bucket: "backups",
            target: "lost.json",
            detail: { batch: null, confirmed: false },
         },
      ]);
   });
});

describe("audit trail of reads and uploads", () => {
   it.each([
      ["", "blockSize=50", { action: "object.list", target: "/" }],
      [
         "/keys",
         "prefix=photos%2F",
         {
            action: "object.list",
            target: "photos/",
            detail: { recursive: true },
         },
      ],
   ])(
      "records the first page of a listing on %s but never a continuation",
      async (path, query, expected) => {
         expect((await fetch(`${base}${path}?${query}`)).status).toBe(200);
         expect(state.audit).toHaveBeenCalledExactlyOnceWith(
            expect.anything(),
            { bucket: "backups", ...expected }
         );
         state.audit.mockClear();
         const next = await fetch(
            `${base}${path}?${query}&continuationToken=next`
         );
         expect(next.status).toBe(200);
         expect(state.audit).not.toHaveBeenCalled();
      }
   );

   it("clips a long listed prefix in the audit target", async () => {
      const prefix = `${"a".repeat(300)}/`;
      const res = await fetch(
         `${base}/keys?prefix=${encodeURIComponent(prefix)}`
      );
      expect(res.status).toBe(200);
      expect(state.audit.mock.calls[0]?.[1]).toMatchObject({
         action: "object.list",
         target: `${"a".repeat(256)}…`,
      });
   });

   it("records a preview with the object's size and type", async () => {
      const response = await fetch(`${base}/preview-url?objectKey=report.png`);
      expect(response.status).toBe(200);
      expect(state.audit).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
         action: "object.view",
         bucket: "backups",
         target: "report.png",
         detail: { size: 12, contentType: "image/png" },
      });
   });

   it("returns full settings from one HEAD without requiring version-read permission", async () => {
      state.send.mockResolvedValueOnce({
         ContentType: "application/json",
         ContentLength: 15,
         ETag: '"reviewed"',
         VersionId: "version-2",
         CacheControl: "max-age=60",
         Metadata: { owner: "ops" },
      });
      const response = await fetch(`${base}/preview-url?objectKey=config.json`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
         eTag: '"reviewed"',
         versionId: "version-2",
         cacheControl: "max-age=60",
         metadata: { owner: "ops" },
         url: "https://signed",
      });
      expect(state.send).toHaveBeenCalledOnce();
      expect(state.presign.mock.calls[0]?.[1].input.VersionId).toBeUndefined();
      const signal = state.getClient.mock.calls[0]?.[2];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(state.send.mock.calls[0]?.[1]).toEqual({ abortSignal: signal });
   });

   it("keeps the KMS key, version and user metadata out of a viewer's preview", async () => {
      state.role = "VIEWER";
      state.send.mockResolvedValueOnce({
         ContentType: "application/json",
         ContentLength: 15,
         ETag: '"reviewed"',
         VersionId: "version-2",
         ContentEncoding: "gzip",
         ServerSideEncryption: "aws:kms",
         SSEKMSKeyId: "arn:aws:kms:us-east-1:123456789012:key/abc",
         Metadata: { owner: "ops" },
      });
      const response = await fetch(`${base}/preview-url?objectKey=config.json`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
         eTag: '"reviewed"',
         contentEncoding: "gzip",
         url: "https://signed",
         versionId: null,
         sseKmsKeyId: null,
         serverSideEncryption: null,
         metadata: {},
      });
   });

   it("cancels the preview HEAD after the browser disconnects", async () => {
      let storageSignal: AbortSignal | undefined;
      state.send.mockImplementation(
         (_command, options) =>
            new Promise((_resolve, reject) => {
               storageSignal = options.abortSignal;
               storageSignal!.addEventListener(
                  "abort",
                  () => reject(storageSignal!.reason),
                  { once: true }
               );
            })
      );
      const controller = new AbortController();
      const response = fetch(`${base}/preview-url?objectKey=config.json`, {
         signal: controller.signal,
      }).catch(() => undefined);
      await vi.waitFor(() => expect(storageSignal).toBeDefined());
      controller.abort();
      await response;
      await vi.waitFor(() => expect(storageSignal?.aborted).toBe(true));
      expect(state.presign).not.toHaveBeenCalled();
   });

   it("records a download link", async () => {
      const response = await fetch(
         `${base}/download-url?objectKey=report.json`
      );
      expect(response.status).toBe(200);
      expect(state.audit).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
         action: "object.download",
         bucket: "backups",
         target: "report.json",
      });
   });

   it("refuses a download link for an object that is gone", async () => {
      state.send.mockRejectedValueOnce({
         name: "NotFound",
         $metadata: { httpStatusCode: 404 },
      });
      const response = await fetch(`${base}/download-url?objectKey=gone.json`);
      expect(response.status).toBe(404);
      expect(state.presign).not.toHaveBeenCalled();
      expect(state.audit).not.toHaveBeenCalled();
   });

   it.each([
      [
         "a replacement",
         `&expectedETag=${encodeURIComponent('"reviewed"')}`,
         true,
      ],
      ["a new object", "", false],
   ])(
      "records %s only once the upload succeeded",
      async (_name, etag, replaced) => {
         const url = `${base}/v3/upload?objectKey=report.json&contentType=text%2Fplain&expectedUserId=${state.actor}${etag}`;
         state.upload.mockRejectedValueOnce(new Error("upload failed"));
         expect(
            (await fetch(url, { method: "PUT", body: "new-data" })).ok
         ).toBe(false);
         expect(state.audit).not.toHaveBeenCalled();

         expect(
            (await fetch(url, { method: "PUT", body: "new-data" })).status
         ).toBe(201);
         expect(state.audit).toHaveBeenCalledExactlyOnceWith(
            expect.anything(),
            {
               action: "object.upload",
               bucket: "backups",
               target: "report.json",
               detail: { size: 8, contentType: "text/plain", replaced },
            }
         );
      }
   );
});

describe("an upload cut off after storage received its commit", () => {
   it("is audited as unconfirmed before the 502 goes out", async () => {
      state.upload.mockRejectedValueOnce(new UnconfirmedWriteError());
      const res = await fetch(
         `${base}/v3/upload?objectKey=report.json&contentType=text%2Fplain&expectedUserId=${state.actor}`,
         { method: "PUT", body: "new-data" }
      );
      expect(res.status).toBe(502);
      expect(state.audit).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
         action: "object.upload",
         bucket: "backups",
         target: "report.json",
         detail: {
            contentType: "text/plain",
            replaced: false,
            confirmed: false,
         },
      });
   });
});

describe("new file key validation", () => {
   it("rejects an invalid upload key before storage", async () => {
      const response = await fetch(
         `${base}/v3/upload?objectKey=docs%2F&contentType=text%2Fplain&expectedUserId=${state.actor}`,
         {
            method: "PUT",
            body: "bytes",
            headers: { "content-type": "text/plain" },
         }
      );
      expect(response.status).toBe(400);
      expect(state.upload).not.toHaveBeenCalled();
      expect(state.getClient).not.toHaveBeenCalled();
   });
});
