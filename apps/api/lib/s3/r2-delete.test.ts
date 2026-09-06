import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { deleteKeys } from "./delete";

type Request = {
   method: string;
   path: string;
   headers: Record<string, string>;
   query: Record<string, string>;
};
const target = { key: "folder/report %.csv", expectedETag: '"reviewed"' };
const response = (
   statusCode = 200,
   headers: Record<string, string> = {},
   code?: string
) => ({
   response: {
      statusCode,
      headers,
      body: Readable.from(code ? [`<Error><Code>${code}</Code></Error>`] : []),
   },
});
const fixture = (
   handle: (request: Request) => Promise<ReturnType<typeof response>>
) => {
   const requests: Request[] = [];
   const client = new S3Client({
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      forcePathStyle: true,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      maxAttempts: 3,
      requestHandler: {
         handle: async (request: Request) => {
            requests.push(request);
            return handle(request);
         },
      },
   });
   const run = (objects = [target], signal?: AbortSignal) =>
      deleteKeys({ client, bucket: "bucket", signal }, objects);
   return { client, requests, run };
};

describe("R2 ordinary key deletion with a stale-selection check", () => {
   it("signs conditional HEAD and sends one ordinary DELETE without unsupported conditions", async () => {
      const f = fixture(async (request) => {
         expect(decodeURIComponent(request.path)).toBe(`/bucket/${target.key}`);
         expect(request.query).not.toHaveProperty("versionId");
         if (request.method === "HEAD") {
            expect(request.headers["if-match"]).toBe(target.expectedETag);
            expect(request.headers.authorization).toContain("if-match");
            return response(200, { etag: target.expectedETag });
         }
         expect(request.method).toBe("DELETE");
         expect(request.headers).not.toHaveProperty("if-match");
         expect(request.headers).not.toHaveProperty("if-none-match");
         expect(request.headers).not.toHaveProperty("x-amz-if-match-size");
         return response(204);
      });
      try {
         expect(await f.run()).toEqual({ deleted: [target.key], failed: [] });
         expect(f.requests.map((r) => r.method)).toEqual(["HEAD", "DELETE"]);
         expect(await f.client.config.maxAttempts()).toBe(3);
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      { status: 412, eTag: undefined },
      { status: 200, eTag: '"changed"' },
      { status: 200, eTag: undefined },
   ])(
      "retains an already-stale or unreadable object: %j",
      async ({ status, eTag }) => {
         const f = fixture(async () =>
            response(status, eTag ? { etag: eTag } : {})
         );
         try {
            expect(await f.run()).toMatchObject({
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: false,
                     message: expect.stringContaining("object changed"),
                  },
               ],
            });
            expect(f.requests.map((r) => r.method)).toEqual(["HEAD"]);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each(["HEAD", "DELETE"])(
      "treats a key already missing during %s as absent",
      async (missingAt) => {
         const f = fixture(async ({ method }) =>
            method === missingAt
               ? response(404, {}, "NoSuchKey")
               : response(200, { etag: target.expectedETag })
         );
         try {
            expect(await f.run()).toEqual({
               deleted: [target.key],
               failed: [],
            });
            expect(f.requests).toHaveLength(missingAt === "HEAD" ? 1 : 2);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each(["HEAD", "DELETE"])(
      "reports denied %s per key without retries",
      async (deniedAt) => {
         const f = fixture(async ({ method }) =>
            method === deniedAt
               ? response(403, {}, "AccessDenied")
               : response(200, { etag: target.expectedETag })
         );
         try {
            expect(await f.run()).toMatchObject({
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: false,
                     message: expect.stringContaining(
                        "credentials don't allow"
                     ),
                  },
               ],
            });
            expect(f.requests).toHaveLength(deniedAt === "HEAD" ? 1 : 2);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each(["lost response", "server error"])(
      "never replays an uncertain deletion after %s",
      async (failure) => {
         let stored = "original";
         const f = fixture(async ({ method }) => {
            if (method === "HEAD")
               return response(200, { etag: target.expectedETag });
            stored = "concurrent same-ETag replacement";
            if (failure === "lost response")
               throw Object.assign(new Error("response lost"), {
                  name: "TimeoutError",
               });
            return response(503, {}, "ServiceUnavailable");
         });
         try {
            expect(await f.run()).toMatchObject({
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: false,
                     message: expect.stringContaining("not confirmed"),
                  },
               ],
            });
            expect(f.requests.map((r) => r.method)).toEqual(["HEAD", "DELETE"]);
            expect(stored).toBe("concurrent same-ETag replacement");
         } finally {
            f.client.destroy();
         }
      }
   );

   it("accounts for folder markers and mixed batch outcomes with at most four requests in flight", async () => {
      const keys = [
         "folder/",
         ...Array.from({ length: 19 }, (_, i) => `folder/nested/file-${i}`),
      ];
      let active = 0;
      let maximum = 0;
      const f = fixture(async ({ method, path }) => {
         active++;
         maximum = Math.max(maximum, active);
         await new Promise<void>((resolve) => setImmediate(resolve));
         active--;
         const key = decodeURIComponent(path.slice("/bucket/".length));
         if (method === "HEAD" && key.endsWith("-5")) return response(412);
         if (method === "DELETE" && key.endsWith("-8"))
            return response(403, {}, "AccessDenied");
         return method === "HEAD"
            ? response(200, { etag: target.expectedETag })
            : response(204);
      });
      try {
         const result = await f.run(keys.map((key) => ({ ...target, key })));
         expect(result.deleted).toEqual(
            keys.filter((key) => !key.endsWith("-5") && !key.endsWith("-8"))
         );
         expect(result.failed.map((failure) => failure.key)).toEqual([
            "folder/nested/file-5",
            "folder/nested/file-8",
         ]);
         expect(result.deleted.length + result.failed.length).toBe(keys.length);
         expect(maximum).toBeGreaterThan(1);
         expect(maximum).toBeLessThanOrEqual(4);
         expect(f.requests).toHaveLength(keys.length * 2 - 1);
      } finally {
         f.client.destroy();
      }
   });

   it("rejects missing reviewed ETags without reading or deleting those keys", async () => {
      const handle = vi.fn(async () => response(204));
      const f = fixture(handle);
      try {
         const invalid = [null, "*", '"*"', "unquoted"];
         const result = await deleteKeys(
            { client: f.client, bucket: "bucket" },
            invalid.map((expectedETag, i) => ({
               key: `invalid-${i}`,
               expectedETag,
            }))
         );
         expect(result.deleted).toEqual([]);
         expect(result.failed).toHaveLength(invalid.length);
         expect(result.failed.every(({ retryable }) => !retryable)).toBe(true);
         expect(handle).not.toHaveBeenCalled();
      } finally {
         f.client.destroy();
      }
   });

   it("stops queued keys and never deletes if cancelled after HEAD", async () => {
      const controller = new AbortController();
      const f = fixture(async ({ method }) => {
         expect(method).toBe("HEAD");
         controller.abort();
         return response(200, { etag: target.expectedETag });
      });
      const objects = Array.from({ length: 12 }, (_, i) => ({
         ...target,
         key: `folder/${i}`,
      }));
      try {
         const result = await f.run(objects, controller.signal);
         expect(result.deleted).toEqual([]);
         expect(result.failed).toHaveLength(objects.length);
         expect(result.failed.every(({ retryable }) => !retryable)).toBe(true);
         expect(f.requests.length).toBeLessThanOrEqual(4);
         expect(f.requests.every(({ method }) => method === "HEAD")).toBe(true);
      } finally {
         f.client.destroy();
      }
   });

   it("does not begin storage requests for an already-cancelled operation", async () => {
      const f = fixture(async () => response(204));
      try {
         expect(await f.run([target], AbortSignal.abort())).toMatchObject({
            deleted: [],
            failed: [{ key: target.key, retryable: false }],
         });
         expect(f.requests).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });
});
