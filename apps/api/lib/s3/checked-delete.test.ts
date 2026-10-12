import { S3_MAX_KEYS_PER_REQUEST } from "@s3-viewer/types";
import { storageCapabilities } from "@/lib/services/storage-capabilities";
import { describe, expect, it, vi } from "vitest";
import {
   empty,
   errorXml,
   reply,
   s3Fixture,
   xml,
   type FixtureReply,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { isUnconfirmed } from "./checked-delete";
import { deleteKeys } from "./delete";
import { clientProvider } from "./provider";

const target = { key: "folder/report %.csv", expectedETag: '"reviewed"' };
const deleteResult = (
   deleted: readonly string[],
   errors: readonly { key: string; code: string }[] = []
) =>
   xml(
      '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
         deleted.map((key) => `<Deleted><Key>${key}</Key></Deleted>`).join("") +
         errors
            .map(
               ({ key, code }) =>
                  `<Error><Key>${key}</Key><Code>${code}</Code></Error>`
            )
            .join("") +
         "</DeleteResult>"
   );
const askedKeys = (body: unknown): string[] =>
   [...String(body).matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => match[1]!);
const endpoints = [
   ["Cloudflare R2", "https://account.r2.cloudflarestorage.com", "auto"],
   ["Backblaze B2", "https://s3.us-west-004.backblazeb2.com", "us-west-004"],
   ["MinIO", "https://minio.example.com", "us-east-1"],
] as const;

describe.each(endpoints)(
   "%s key deletion with a stale-selection check",
   (_name, endpoint, region) => {
      const fixture = (
         handle: (request: FixtureRequest) => Promise<FixtureReply>
      ) => {
         const { client, requests } = s3Fixture(handle, {
            endpoint,
            region,
            maxAttempts: 3,
         });
         const run = (
            objects: { key: string; expectedETag: string | null }[] = [target],
            signal?: AbortSignal
         ) => deleteKeys({ client, bucket: "bucket", signal }, objects);
         return { client, requests, run };
      };

      it("signs conditional HEAD and batches one ordinary delete without unsupported conditions", async () => {
         const f = fixture(async (request) => {
            expect(request.query).not.toHaveProperty("versionId");
            if (request.method === "HEAD") {
               expect(decodeURIComponent(request.path)).toBe(
                  `/bucket/${target.key}`
               );
               expect(request.headers["if-match"]).toBe(target.expectedETag);
               expect(request.headers.authorization).toContain("if-match");
               return empty(200, { etag: target.expectedETag });
            }
            expect(request.method).toBe("POST");
            expect(decodeURIComponent(request.path)).toBe("/bucket/");
            expect(request.query).toHaveProperty("delete");
            expect(askedKeys(request.body)).toEqual([target.key]);
            expect(String(request.body)).not.toContain("<ETag>");
            expect(request.headers).not.toHaveProperty("if-match");
            expect(request.headers).not.toHaveProperty("if-none-match");
            expect(request.headers).not.toHaveProperty("x-amz-if-match-size");
            return deleteResult([target.key]);
         });
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [],
               deleted: [target.key],
               failed: [],
            });
            expect(f.requests.map((r) => r.method)).toEqual(["HEAD", "POST"]);
            expect(await f.client.config.maxAttempts()).toBe(3);
         } finally {
            f.client.destroy();
         }
      });

      it("deletes a key the caller never reviewed after an unconditional read", async () => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: '"live"' })
               : deleteResult([target.key])
         );
         try {
            expect(
               await f.run([{ key: target.key, expectedETag: null }])
            ).toEqual({ alreadyGone: [], deleted: [target.key], failed: [] });
            expect(f.requests.map((r) => r.method)).toEqual(["HEAD", "POST"]);
            expect(f.requests[0]?.headers).not.toHaveProperty("if-match");
         } finally {
            f.client.destroy();
         }
      });

      it("reports checked protection when a writer can replace a key between HEAD and deletion", async () => {
         let stored: string | null = "reviewed content";
         const f = fixture(async ({ method }) => {
            if (method === "HEAD") {
               stored = "concurrent replacement";
               return empty(200, { etag: target.expectedETag });
            }
            expect(stored).toBe("concurrent replacement");
            stored = null;
            return deleteResult([target.key]);
         });
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [],
               deleted: [target.key],
               failed: [],
            });
            expect(stored).toBeNull();
            expect(
               storageCapabilities(await clientProvider(f.client), endpoint)
                  .deleteProtection
            ).toBe("checked");
         } finally {
            f.client.destroy();
         }
      });

      it("spends one delete request per 1000 confirmed keys", async () => {
         const keys = Array.from(
            { length: S3_MAX_KEYS_PER_REQUEST + 1 },
            (_, i) => `folder/file-${i}`
         );
         const f = fixture(async ({ method, body }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : deleteResult(askedKeys(body))
         );
         try {
            const result = await f.run(keys.map((key) => ({ ...target, key })));
            expect(result).toEqual({
               alreadyGone: [],
               deleted: keys,
               failed: [],
            });
            const batches = f.requests.filter((r) => r.method === "POST");
            expect(batches.map((r) => askedKeys(r.body).length)).toEqual([
               S3_MAX_KEYS_PER_REQUEST,
               1,
            ]);
            expect(f.requests).toHaveLength(keys.length + batches.length);
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
               empty(status, eTag ? { etag: eTag } : {})
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

      it("treats a key already missing during HEAD as absent", async () => {
         const f = fixture(async () => reply(404, errorXml("NoSuchKey")));
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [target.key],
               deleted: [],
               failed: [],
            });
            expect(f.requests.map(({ method }) => method)).toEqual(["HEAD"]);
         } finally {
            f.client.destroy();
         }
      });

      it("treats a key the batch reports as missing as absent", async () => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : deleteResult([], [{ key: target.key, code: "NoSuchKey" }])
         );
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [target.key],
               deleted: [],
               failed: [],
            });
         } finally {
            f.client.destroy();
         }
      });

      it.each(["HEAD", "POST"])(
         "reports denied %s per key without retries",
         async (deniedAt) => {
            const f = fixture(async ({ method }) =>
               method === deniedAt
                  ? reply(403, errorXml("AccessDenied"))
                  : empty(200, { etag: target.expectedETag })
            );
            try {
               expect(await f.run()).toEqual({
                  alreadyGone: [],
                  deleted: [],
                  failed: [
                     {
                        key: target.key,
                        retryable: false,
                        message: "The server credentials don't allow this",
                     },
                  ],
               });
               expect(f.requests).toHaveLength(deniedAt === "HEAD" ? 1 : 2);
            } finally {
               f.client.destroy();
            }
         }
      );

      it("reports a denial the batch reports per key with the same message", async () => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : deleteResult([], [{ key: target.key, code: "AccessDenied" }])
         );
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [],
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: true,
                     message: "The server credentials don't allow this",
                  },
               ],
            });
         } finally {
            f.client.destroy();
         }
      });

      it.each([
         ["names it nowhere", () => deleteResult([])],
         [
            "reports a server fault for it",
            () =>
               deleteResult([], [{ key: target.key, code: "InternalError" }]),
         ],
      ])("reports a key the batch %s as unconfirmed", async (_name, answer) => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : answer()
         );
         try {
            const result = await f.run();
            expect(result).toEqual({
               alreadyGone: [],
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: false,
                     message:
                        "Deletion was not confirmed. Refresh and check this object before trying again.",
                  },
               ],
            });
            expect(result.failed.every(isUnconfirmed)).toBe(true);
         } finally {
            f.client.destroy();
         }
      });

      it.each(["SlowDown", "ServiceUnavailable"])(
         "reports a key the batch throttles with %s as retryable",
         async (code) => {
            const f = fixture(async ({ method }) =>
               method === "HEAD"
                  ? empty(200, { etag: target.expectedETag })
                  : deleteResult([], [{ key: target.key, code }])
            );
            try {
               expect(await f.run()).toEqual({
                  alreadyGone: [],
                  deleted: [],
                  failed: [
                     {
                        key: target.key,
                        retryable: true,
                        message:
                           "Storage is throttling requests. Try again shortly.",
                     },
                  ],
               });
            } finally {
               f.client.destroy();
            }
         }
      );

      it("reports a batch request storage throttles as retryable", async () => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : reply(503, errorXml("SlowDown"))
         );
         try {
            expect(await f.run()).toEqual({
               alreadyGone: [],
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     retryable: true,
                     message:
                        "Storage is throttling requests. Try again shortly.",
                  },
               ],
            });
         } finally {
            f.client.destroy();
         }
      });

      it("gives every key in a failed batch its own precondition outcome", async () => {
         const keys = ["a", "b", "c"];
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : empty(412)
         );
         try {
            const result = await f.run(keys.map((key) => ({ ...target, key })));
            expect(result.deleted).toEqual([]);
            expect(result.failed).toEqual(
               keys.map((key) => ({
                  key,
                  message:
                     "The object changed. Refresh and review it before deleting.",
                  retryable: false,
               }))
            );
         } finally {
            f.client.destroy();
         }
      });

      it("does not interpret a whole-request 404 as confirmed per-key deletion", async () => {
         const f = fixture(async ({ method }) =>
            method === "HEAD"
               ? empty(200, { etag: target.expectedETag })
               : empty(404)
         );
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
         } finally {
            f.client.destroy();
         }
      });

      it.each(["lost response", "server error"])(
         "never replays an uncertain deletion after %s",
         async (failure) => {
            let stored = "original";
            const f = fixture(async ({ method }) => {
               if (method === "HEAD")
                  return empty(200, { etag: target.expectedETag });
               stored = "concurrent same-ETag replacement";
               if (failure === "lost response")
                  throw Object.assign(new Error("response lost"), {
                     name: "TimeoutError",
                  });
               return reply(500, errorXml("InternalError"));
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
               expect(f.requests.map((r) => r.method)).toEqual([
                  "HEAD",
                  "POST",
               ]);
               expect(stored).toBe("concurrent same-ETag replacement");
            } finally {
               f.client.destroy();
            }
         }
      );

      it("accounts for folder markers and mixed batch outcomes with a bounded number of requests in flight", async () => {
         const keys = [
            "folder/",
            ...Array.from({ length: 19 }, (_, i) => `folder/nested/file-${i}`),
         ];
         let active = 0;
         let maximum = 0;
         const f = fixture(async ({ method, path, body }) => {
            active++;
            maximum = Math.max(maximum, active);
            await new Promise<void>((resolve) => setImmediate(resolve));
            active--;
            if (method === "HEAD") {
               const key = decodeURIComponent(path.slice("/bucket/".length));
               return key.endsWith("-5")
                  ? empty(412)
                  : empty(200, { etag: target.expectedETag });
            }
            const asked = askedKeys(body);
            expect(asked).not.toContain("folder/nested/file-5");
            return deleteResult(
               asked.filter((key) => !key.endsWith("-8")),
               asked
                  .filter((key) => key.endsWith("-8"))
                  .map((key) => ({ key, code: "AccessDenied" }))
            );
         });
         try {
            const result = await f.run(keys.map((key) => ({ ...target, key })));
            expect(result.deleted).toEqual(
               keys.filter((key) => !key.endsWith("-5") && !key.endsWith("-8"))
            );
            expect(result.failed).toEqual([
               {
                  key: "folder/nested/file-5",
                  message:
                     "The object changed. Refresh and review it before deleting.",
                  retryable: false,
               },
               {
                  key: "folder/nested/file-8",
                  message: "The server credentials don't allow this",
                  retryable: true,
               },
            ]);
            expect(result.deleted.length + result.failed.length).toBe(
               keys.length
            );
            expect(maximum).toBeGreaterThan(1);
            expect(maximum).toBeLessThanOrEqual(16);
            expect(f.requests).toHaveLength(keys.length + 1);
            expect(f.requests.filter((r) => r.method === "POST")).toHaveLength(
               1
            );
         } finally {
            f.client.destroy();
         }
      });

      it("rejects malformed reviewed ETags without reading or deleting those keys", async () => {
         const handle = vi.fn(async () => empty(204));
         const f = fixture(handle);
         try {
            const invalid = ["*", '"*"', "unquoted"];
            const result = await deleteKeys(
               { client: f.client, bucket: "bucket" },
               invalid.map((expectedETag, i) => ({
                  key: `invalid-${i}`,
                  expectedETag,
               }))
            );
            expect(result.deleted).toEqual([]);
            expect(result.failed).toHaveLength(invalid.length);
            expect(result.failed.every(({ retryable }) => !retryable)).toBe(
               true
            );
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
            return empty(200, { etag: target.expectedETag });
         });
         const objects = Array.from({ length: 40 }, (_, i) => ({
            ...target,
            key: `folder/${i}`,
         }));
         try {
            const result = await f.run(objects, controller.signal);
            expect(result.deleted).toEqual([]);
            expect(result.failed).toHaveLength(objects.length);
            expect(result.failed.every(({ retryable }) => !retryable)).toBe(
               true
            );
            expect(f.requests.length).toBeLessThanOrEqual(16);
            expect(f.requests.every(({ method }) => method === "HEAD")).toBe(
               true
            );
         } finally {
            f.client.destroy();
         }
      });

      it("does not begin storage requests for an already-cancelled operation", async () => {
         const f = fixture(async () => empty(204));
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
   }
);

describe("isUnconfirmed", () => {
   it("tells a delete that may have happened from one that plainly failed", () => {
      const failure = { key: "a", retryable: false };
      expect(
         isUnconfirmed({
            ...failure,
            message:
               "Deletion was not confirmed. Refresh and check this object before trying again.",
         })
      ).toBe(true);
      expect(isUnconfirmed({ ...failure, message: "Access denied" })).toBe(
         false
      );
   });
});
