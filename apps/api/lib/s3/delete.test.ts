import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { deleteKeys } from "./delete";

const target = { key: "report.csv", expectedETag: '"original"' };
const providers = [
   {
      name: "AWS S3",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      conditional: true,
   },
] as const;
const unsupportedProviders = [
   { name: "MinIO", endpoint: "https://minio.example.com", conditional: false },
   {
      name: "Backblaze B2",
      endpoint: "https://s3.us-west-004.backblazeb2.com",
      conditional: false,
   },
] as const;

type Request = { method: string; body: unknown };
const response = (body: string) => ({
   response: {
      statusCode: 200,
      headers: { "content-type": "application/xml" },
      body: Readable.from([body]),
   },
});
const clientFor = (
   endpoint: string,
   handle: (request: Request) => Promise<ReturnType<typeof response>>
) =>
   new S3Client({
      region: "us-east-1",
      endpoint,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      maxAttempts: 2,
      forcePathStyle: true,
      requestHandler: { handle },
   });
const success =
   '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Deleted><Key>report.csv</Key></Deleted></DeleteResult>';

describe("conditional deletion without SDK replay", () => {
   it.each(providers)(
      "requires the reviewed ETag on $name",
      async ({ endpoint, conditional }) => {
         const requests: Request[] = [];
         const client = clientFor(endpoint, async (request) => {
            requests.push(request);
            return response(success);
         });
         try {
            expect(
               await deleteKeys({ client, bucket: "bucket" }, [target])
            ).toEqual({ deleted: [target.key], failed: [] });
            expect(requests).toHaveLength(1);
            expect(requests[0]?.method).toBe("POST");
            const body = String(requests[0]?.body);
            expect(body).toContain("<Key>report.csv</Key>");
            expect(body.includes("<ETag>original</ETag>")).toBe(conditional);
            expect(body).not.toContain("VersionId");
         } finally {
            client.destroy();
         }
      }
   );

   it.each(providers)(
      "does not replay a lost response against a same-ETag replacement on $name",
      async ({ endpoint }) => {
         const objects = new Map([
            [
               target.key,
               { eTag: target.expectedETag, metadata: "reviewed original" },
            ],
         ]);
         let attempts = 0;
         const client = clientFor(endpoint, async () => {
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
            return response(success);
         });
         try {
            await expect(
               deleteKeys({ client, bucket: "bucket" }, [target])
            ).rejects.toMatchObject({ status: 502 });
            expect(attempts).toBe(1);
            expect(objects.get(target.key)?.metadata).toBe(
               "unreviewed replacement"
            );
            expect(await client.config.maxAttempts()).toBe(2);
         } finally {
            client.destroy();
         }
      }
   );

   it.each([null, "*", '"*"', "unquoted"])(
      "refuses an absent or invalid reviewed ETag %s without sending a delete",
      async (expectedETag) => {
         const handle = vi.fn(async () => response(success));
         const client = clientFor(providers[0].endpoint, handle);
         try {
            expect(
               await deleteKeys({ client, bucket: "bucket" }, [
                  { ...target, expectedETag },
               ])
            ).toEqual({
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

   it.each(unsupportedProviders)(
      "does not attempt unconditional deletion on $name",
      async ({ endpoint }) => {
         const handle = vi.fn(async () => response(success));
         const client = clientFor(endpoint, handle);
         try {
            expect(
               await deleteKeys({ client, bucket: "bucket" }, [target])
            ).toEqual({
               deleted: [],
               failed: [
                  {
                     key: target.key,
                     message: expect.stringContaining(
                        "Deletion is unavailable"
                     ),
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

   it("deletes only reviewed entries from a mixed AWS batch", async () => {
      const client = clientFor(providers[0].endpoint, async (request) => {
         expect(String(request.body)).toContain("<Key>report.csv</Key>");
         expect(String(request.body)).toContain("<ETag>original</ETag>");
         expect(String(request.body)).not.toContain("unreviewed");
         return response(success);
      });
      try {
         expect(
            await deleteKeys({ client, bucket: "bucket" }, [
               target,
               { key: "unreviewed", expectedETag: null },
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
      const client = clientFor(providers[0].endpoint, async (request) => {
         expect(String(request.body)).toContain("<ETag>original</ETag>");
         return response(
            '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Error><Key>report.csv</Key><Code>PreconditionFailed</Code></Error></DeleteResult>'
         );
      });
      try {
         const result = await deleteKeys({ client, bucket: "bucket" }, [
            target,
         ]);
         expect(result).toEqual({
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
      const client = clientFor(providers[0].endpoint, async () =>
         response(
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
});
