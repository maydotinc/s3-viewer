import express from "express";
import { S3Client } from "@aws-sdk/client-s3";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { errorHandler } from "@/lib/http";
import { isObjectUpload } from "@/lib/middleware/upload-body";
import { objectsRouter } from "./objects";

const state = vi.hoisted(() => ({
   actor: "actor12345",
   role: "OWNER" as "OWNER" | "VIEWER" | null,
   getClient: vi.fn(),
   upload: vi.fn(),
   remove: vi.fn(),
   audit: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: {
         findUnique: async () =>
            state.role
               ? {
                    role: state.role,
                    server: {
                       allowedBuckets: ["backups"],
                       restrictedBuckets: true,
                       bucketAccess: [{ role: state.role }],
                    },
                 }
               : null,
      },
   },
}));
vi.mock("@/lib/s3/client-cache", () => ({ getS3Client: state.getClient }));
vi.mock("@/lib/s3/upload", async (original) => ({
   ...(await original<typeof import("@/lib/s3/upload")>()),
   streamUpload: state.upload,
}));
vi.mock("@/lib/s3/delete", () => ({ deleteKeys: state.remove }));
vi.mock("@/lib/services/audit", () => ({ recordAudit: state.audit }));

let server: ReturnType<typeof createServer>;
let base: string;
beforeAll(async () => {
   const app = express();
   const json = express.json({ limit: "1mb" });
   app.use((req, res, next) =>
      isObjectUpload(req) ? next() : json(req, res, next)
   );
   app.use((req, _res, next) => {
      req.user = {
         id: state.actor,
         email: "actor@example.com",
         emailVerified: true,
         name: "Actor",
         createdAt: new Date(),
         updatedAt: new Date(),
      };
      next();
   });
   app.use("/servers/:serverId/buckets/:bucketName/objects", objectsRouter);
   app.use(errorHandler);
   server = createServer(app);
   await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });
   base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/servers/server12345/buckets/backups/objects`;
});
afterAll(async () => {
   if (!server) return;
   server.closeAllConnections();
   await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
   state.actor = "actor12345";
   state.role = "OWNER";
   state.getClient.mockReset().mockResolvedValue({});
   state.audit.mockReset().mockResolvedValue(undefined);
   state.remove
      .mockReset()
      .mockResolvedValue({ deleted: ["report.json"], failed: [] });
   state.upload.mockReset().mockImplementation(async ({ body }) => {
      let size = 0;
      for await (const chunk of body) size += Buffer.byteLength(chunk);
      return { size, eTag: '"stored"' };
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
};

describe("versioned object mutation boundaries", () => {
   it.each([undefined, null, "*", '"*"', 'W/"old"', ""])(
      "requires a reviewed ETag for rename: %s",
      async (expectedETag) => {
         const response = await fetch(`${base}/v3/rename`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
               expectedUserId: state.actor,
               objectKey: "report.json",
               newObjectKey: "renamed.json",
               expectedETag,
            }),
         });
         expect(response.status).toBe(400);
         expectNoStorage();
      }
   );
   it.each(["*", '"*"'])(
      "rejects wildcard deletion %s before storage work",
      async (expectedETag) => {
         const response = await fetch(`${base}/v3`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
               expectedUserId: state.actor,
               objects: [{ key: "report.json", expectedETag }],
            }),
         });
         expect(response.status).toBe(400);
         expectNoStorage();
      }
   );
   it.each(requests)(
      "rejects a changed account on $method $path before storage work",
      async (request) => {
         const response = await send(request, "other12345");
         expect(response.status).toBe(403);
         expect(await response.json()).toMatchObject({
            message: expect.stringContaining("account changed"),
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

   it.each(requests)(
      "rejects removed members on $method $path",
      async (request) => {
         state.role = null;
         expect((await send(request, state.actor)).status).toBe(404);
         expectNoStorage();
      }
   );

   it.each(requests)(
      "applies operation availability after authorizing $method $path",
      async (request) => {
         const response = await send(request, state.actor);
         if (request.method === "POST") {
            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({
               message: expect.stringContaining("Rename is unavailable"),
            });
            expectNoStorage();
            return;
         }
         expect(response.status).toBe(request.method === "PUT" ? 201 : 200);
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

   it("refuses AWS replacement before regional discovery or upload", async () => {
      state.getClient.mockResolvedValue({
         config: {
            endpoint: async () => ({
               protocol: "https:",
               hostname: "s3.us-east-1.amazonaws.com",
            }),
         },
      });
      const response = await fetch(
         `${base}/v3/upload?objectKey=report.json&contentType=text%2Fplain&expectedUserId=${state.actor}&expectedETag=${encodeURIComponent('"reviewed"')}`,
         {
            method: "PUT",
            body: "new-data",
         }
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
         message: expect.stringContaining("Replacement is unavailable"),
      });
      expect(state.getClient).toHaveBeenCalledExactlyOnceWith("server12345");
      expect(state.upload).not.toHaveBeenCalled();
   });

   it("retains R2 replacement after checking the provider", async () => {
      state.getClient.mockResolvedValue({
         config: {
            endpoint: async () => ({
               protocol: "https:",
               hostname: "account.r2.cloudflarestorage.com",
            }),
         },
      });
      const response = await fetch(
         `${base}/v3/upload?objectKey=report.json&contentType=text%2Fplain&expectedUserId=${state.actor}&expectedETag=${encodeURIComponent('"reviewed"')}`,
         {
            method: "PUT",
            body: "new-data",
         }
      );
      expect(response.status).toBe(201);
      expect(state.upload).toHaveBeenCalledWith(
         expect.objectContaining({ expectedETag: '"reviewed"' })
      );
   });

   it("executes authorized R2 deletion and reports stale keys separately", async () => {
      const { deleteKeys } =
         await vi.importActual<typeof import("@/lib/s3/delete")>(
            "@/lib/s3/delete"
         );
      const sent: { method: string; path: string }[] = [];
      const client = new S3Client({
         region: "auto",
         endpoint: "https://account.r2.cloudflarestorage.com",
         credentials: { accessKeyId: "test", secretAccessKey: "test" },
         forcePathStyle: true,
         requestHandler: {
            handle: async (request: { method: string; path: string }) => {
               sent.push({ method: request.method, path: request.path });
               return {
                  response: {
                     statusCode: request.method === "HEAD" ? 200 : 204,
                     headers:
                        request.method === "HEAD"
                           ? {
                                etag: request.path.endsWith("stale.json")
                                   ? '"changed"'
                                   : '"reviewed"',
                                "content-length": "0",
                             }
                           : {},
                     body: Readable.from([]),
                  },
               };
            },
         },
      });
      state.getClient.mockResolvedValue(client);
      state.remove.mockImplementation(deleteKeys);
      try {
         const response = await fetch(`${base}/v3`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
               expectedUserId: state.actor,
               objects: ["report.json", "stale.json"].map((key) => ({
                  key,
                  expectedETag: '"reviewed"',
               })),
            }),
         });
         expect(response.status).toBe(207);
         expect(await response.json()).toMatchObject({
            deleted: ["report.json"],
            failed: [{ key: "stale.json", retryable: false }],
         });
         expect(sent.filter(({ method }) => method === "DELETE")).toEqual([
            { method: "DELETE", path: "/backups/report.json" },
         ]);
         expect(state.audit).toHaveBeenCalledWith(
            expect.objectContaining({
               actorId: state.actor,
               action: "object.delete",
            })
         );
      } finally {
         client.destroy();
      }
   });

   it.each([
      { method: "PUT", path: "" },
      { method: "PUT", path: "/upload" },
      { method: "DELETE", path: "" },
      { method: "POST", path: "/rename" },
   ])(
      "refuses legacy $method $path without side effects",
      async ({ method, path }) => {
         const response = await fetch(`${base}${path}`, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ objectKeys: ["report.json"] }),
         });
         expect(response.status).toBe(409);
         expect(await response.json()).toMatchObject({
            message: expect.stringContaining("updated app"),
         });
         expectNoStorage();
      }
   );
});
