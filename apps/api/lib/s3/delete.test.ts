import { describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   empty,
   s3Fixture,
   xml,
   type FixtureReply,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { deleteKeys } from "./delete";

const target = { key: "report.csv", expectedETag: '"original"' };

const head = (eTag?: string, statusCode = 200): FixtureReply =>
   empty(statusCode, eTag ? { etag: eTag } : {});
const clientFor = (
   handle: (request: FixtureRequest) => Promise<FixtureReply>
) => s3Fixture(handle, { endpoint: AWS_ENDPOINT, maxAttempts: 2 }).client;
const encoded = (key: string) =>
   key.split("/").map(encodeURIComponent).join("/");
const success =
   '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>report.csv</Key></Deleted></DeleteResult>';

describe("conditional deletion without SDK replay", () => {
   it("requires the reviewed ETag on AWS S3", async () => {
      const requests: FixtureRequest[] = [];
      const client = clientFor(async (request) => {
         requests.push(request);
         return xml(success);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [target])
         ).toEqual({ alreadyGone: [], deleted: [target.key], failed: [] });
         expect(requests).toHaveLength(1);
         expect(requests[0]?.method).toBe("POST");
         const body = String(requests[0]?.body);
         expect(body).toContain("<Key>report.csv</Key>");
         expect(body).toContain("<ETag>original</ETag>");
         expect(body).not.toContain("VersionId");
      } finally {
         client.destroy();
      }
   });

   it("does not replay a lost response against a same-ETag replacement", async () => {
      const objects = new Map([
         [
            target.key,
            { eTag: target.expectedETag, metadata: "reviewed original" },
         ],
      ]);
      let attempts = 0;
      const client = clientFor(async () => {
         attempts++;
         objects.delete(target.key);
         if (attempts === 1) {
            objects.set(target.key, {
               eTag: target.expectedETag,
               metadata: "unreviewed replacement",
            });
            throw Object.assign(new Error("response lost"), {
               name: "TimeoutError",
            });
         }
         return xml(success);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [target])
         ).toEqual({
            alreadyGone: [],
            deleted: [],
            failed: [
               {
                  key: target.key,
                  retryable: false,
                  message: expect.stringContaining("not confirmed"),
               },
            ],
         });
         expect(attempts).toBe(1);
         expect(objects.get(target.key)?.metadata).toBe(
            "unreviewed replacement"
         );
         expect(await client.config.maxAttempts()).toBe(2);
      } finally {
         client.destroy();
      }
   });

   it.each(["*", '"*"', "unquoted"])(
      "refuses an invalid reviewed ETag %s without sending a delete",
      async (expectedETag) => {
         const handle = vi.fn(async () => xml(success));
         const client = clientFor(handle);
         try {
            expect(
               await deleteKeys({ client, bucket: "bucket" }, [
                  { ...target, expectedETag },
               ])
            ).toEqual({
               alreadyGone: [],
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     message: expect.stringContaining("valid reviewed ETag"),
                     retryable: false,
                  },
               ],
            });
            expect(handle).not.toHaveBeenCalled();
         } finally {
            client.destroy();
         }
      }
   );

   it("reads the live version before deleting a key the caller never reviewed", async () => {
      const requests: FixtureRequest[] = [];
      const client = clientFor(async (request) => {
         requests.push(request);
         return request.method === "HEAD" ? head('"live"') : xml(success);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [
               { key: target.key, expectedETag: null },
            ])
         ).toEqual({ alreadyGone: [], deleted: [target.key], failed: [] });
         expect(requests.map((r) => r.method)).toEqual(["HEAD", "POST"]);
         expect(requests[0]?.headers).not.toHaveProperty("if-match");
         expect(String(requests[1]?.body)).toContain("<ETag>live</ETag>");
      } finally {
         client.destroy();
      }
   });

   it("reports an unreviewed key that is already gone apart from deletions", async () => {
      const requests: FixtureRequest[] = [];
      const client = clientFor(async (request) => {
         requests.push(request);
         return head(undefined, 404);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [
               { key: target.key, expectedETag: null },
            ])
         ).toEqual({ alreadyGone: [target.key], deleted: [], failed: [] });
         expect(requests.map((r) => r.method)).toEqual(["HEAD"]);
      } finally {
         client.destroy();
      }
   });

   it("deletes only valid entries from a mixed AWS batch", async () => {
      const client = clientFor(async (request) => {
         expect(String(request.body)).toContain("<Key>report.csv</Key>");
         expect(String(request.body)).toContain("<ETag>original</ETag>");
         expect(String(request.body)).not.toContain("unreviewed");
         return xml(success);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [
               target,
               { key: "unreviewed", expectedETag: "unquoted" },
            ])
         ).toMatchObject({
            deleted: [target.key],
            failed: [{ key: "unreviewed", retryable: false }],
         });
      } finally {
         client.destroy();
      }
   });

   it("retains AWS preconditions and requires review after a content change", async () => {
      const client = clientFor(async (request) => {
         expect(String(request.body)).toContain("<ETag>original</ETag>");
         return xml(
            '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Error><Key>report.csv</Key><Code>PreconditionFailed</Code></Error></DeleteResult>'
         );
      });
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            target,
         ]);
         expect(result).toEqual({
            alreadyGone: [],
            deleted: [],
            failed: [
               {
                  key: target.key,
                  message:
                     "The object changed. Refresh and review it before deleting.",
                  retryable: false,
               },
            ],
         });
      } finally {
         client.destroy();
      }
   });

   it("accounts for every key and permits retry only for confirmed provider failures", async () => {
      const client = clientFor(async () =>
         xml(
            '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>ok</Key></Deleted><Deleted><Key>both</Key></Deleted><Deleted><Key>unsolicited</Key></Deleted><Error><Key>both</Key><Code>AccessDenied</Code></Error><Error><Key>denied</Key><Code>AccessDenied</Code></Error></DeleteResult>'
         )
      );
      try {
         const result = await deleteKeys(
            { client, bucket: "bucket" },
            ["ok", "both", "missing", "denied"].map((key) => ({
               ...target,
               key,
            }))
         );
         expect(result.deleted).toEqual(["ok"]);
         expect(
            result.failed.map(({ key, retryable }) => ({ key, retryable }))
         ).toEqual([
            { key: "both", retryable: false },
            { key: "missing", retryable: false },
            { key: "denied", retryable: true },
         ]);
      } finally {
         client.destroy();
      }
   });
   it.each(["nul\0name", "tab\tname", "line\r\nname", "noncharacter￿"])(
      "deletes XML-unsafe key %j through its exact path with the reviewed condition",
      async (key) => {
         const requests: FixtureRequest[] = [];
         const client = clientFor(async (request) => {
            requests.push(request);
            return head(undefined, 204);
         });
         try {
            expect(
               await deleteKeys({ client, bucket: "bucket" }, [
                  { key, expectedETag: target.expectedETag },
               ])
            ).toEqual({ alreadyGone: [], deleted: [key], failed: [] });
            expect(requests.map((r) => r.method)).toEqual(["DELETE"]);
            expect(requests[0]?.path).toBe(`/bucket/${encoded(key)}`);
            expect(requests[0]?.headers["if-match"]).toBe(target.expectedETag);
         } finally {
            client.destroy();
         }
      }
   );

   it.each(["lost response", "server error", "missing bucket", "cancelled"])(
      "preserves a confirmed exact-key deletion when the remaining batch is %s",
      async (failure) => {
         const exact = { ...target, key: "legacy\u0001.csv" };
         const controller = new AbortController();
         const requests: string[] = [];
         const client = clientFor(async (request) => {
            requests.push(request.method);
            if (request.method === "DELETE") {
               if (failure === "cancelled") controller.abort();
               return head(undefined, 204);
            }
            if (failure === "lost response")
               throw Object.assign(new Error("lost response"), {
                  name: "TimeoutError",
               });
            return head(undefined, failure === "missing bucket" ? 404 : 503);
         });
         try {
            expect(
               await deleteKeys(
                  { client, bucket: "bucket", signal: controller.signal },
                  [exact, target]
               )
            ).toEqual({
               alreadyGone: [],
               deleted: [exact.key],
               failed: [
                  {
                     key: target.key,
                     retryable: false,
                     message: expect.stringContaining(
                        failure === "cancelled" ? "cancelled" : "not confirmed"
                     ),
                  },
               ],
            });
            expect(requests).toEqual(
               failure === "cancelled" ? ["DELETE"] : ["DELETE", "POST"]
            );
         } finally {
            client.destroy();
         }
      }
   );
});
