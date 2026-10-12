import {
   GetObjectAclCommand,
   GetObjectTaggingCommand,
   HeadObjectCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { DEFAULT_CONTENT_TYPE, MIB, Provider } from "@s3-viewer/types";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   MINIO_ENDPOINT,
   R2_ENDPOINT,
   empty,
   errorXml,
   reply,
   s3Fixture,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { prepareUpload } from "./replacement-settings";
import { streamUpload } from "./upload";

const fixture = (
   options: {
      headers?: Record<string, string>;
      changeAfterPart?: boolean;
      changeAfterRead?: boolean;
      headConflict?: boolean;
      omitContentType?: boolean;
   } = {}
) => {
   let changed = false;
   let reads = 0;
   const { client, requests } = s3Fixture(
      async (request) => {
         let body = "";
         let statusCode = 200;
         let headers: Record<string, string> = { etag: '"replacement"' };
         if (request.method === "HEAD") {
            reads++;
            if (options.changeAfterRead && reads > 1) changed = true;
            headers = {
               etag: '"reviewed"',
               "content-length": "8",
               "content-type": "text/plain",
               "x-amz-meta-owner": "finance",
               "cache-control": changed
                  ? "private, no-store"
                  : "private, max-age=60",
               "content-disposition": 'attachment; filename="report.txt"',
               "content-language": "en",
               "x-amz-storage-class": "STANDARD_IA",
               ...options.headers,
            };
            if (options.omitContentType) delete headers["content-type"];
            if (options.headConflict) statusCode = 412;
         } else if ("uploads" in request.query) {
            body =
               "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>";
         } else if ("partNumber" in request.query) {
            if (options.changeAfterPart) changed = true;
         } else if (request.method === "POST" && "uploadId" in request.query) {
            body =
               '<CompleteMultipartUploadResult><ETag>"replacement"</ETag></CompleteMultipartUploadResult>';
         }
         return reply(statusCode, body, headers);
      },
      {
         endpoint: R2_ENDPOINT,
         region: "auto",
         maxAttempts: 1,
         requestChecksumCalculation: "WHEN_REQUIRED",
      }
   );
   const run = (size = 8, contentType = "application/octet-stream") =>
      streamUpload({
         client,
         bucket: "bucket",
         key: "report.txt",
         expectedETag: '"reviewed"',
         contentType,
         body: Readable.from([Buffer.alloc(size, 41)]),
         contentLength: size,
         partSize: 5 * MIB,
         maxBytes: 10 * MIB,
         abortController: new AbortController(),
      });
   const mutations = () =>
      requests.filter((r) => ["PUT", "POST", "DELETE"].includes(r.method));
   return { client, run, requests, mutations };
};

describe("R2 replacements preserve reviewed object settings", () => {
   it("writes the caller's content type over the stored one", async () => {
      const f = fixture();
      try {
         await f.run(8, "text/csv");
         const put = f.requests.find((r) => r.method === "PUT");
         expect(put?.headers["content-type"]).toBe("text/csv");
         expect(put?.headers["cache-control"]).toBe("private, max-age=60");
         expect(put?.headers["x-amz-meta-owner"]).toBe("finance");
      } finally {
         f.client.destroy();
      }
   });

   it("keeps the stored type when the caller only knows the generic default", async () => {
      const f = fixture({
         headers: { "content-type": "application/vnd.apache.parquet" },
      });
      try {
         await f.run(8, DEFAULT_CONTENT_TYPE);
         const put = f.requests.find((r) => r.method === "PUT");
         expect(put?.headers["content-type"]).toBe(
            "application/vnd.apache.parquet"
         );
      } finally {
         f.client.destroy();
      }
   });

   it("falls back to the generic default when the replaced object carried no type", async () => {
      const f = fixture({ omitContentType: true });
      try {
         await f.run(8, DEFAULT_CONTENT_TYPE);
         const put = f.requests.find((r) => r.method === "PUT");
         expect(put?.headers["content-type"]).toBe(DEFAULT_CONTENT_TYPE);
      } finally {
         f.client.destroy();
      }
   });

   it("maps a bodyless HEAD precondition failure to an upload conflict", async () => {
      const f = fixture({ headConflict: true });
      try {
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.mutations()).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it("handles input disconnects while replacement settings are being read", async () => {
      const body = new PassThrough();
      const controller = new AbortController();
      const { promise: started, resolve: begin } =
         Promise.withResolvers<void>();
      const { client } = s3Fixture(
         (_request, options) => {
            begin();
            return new Promise((_resolve, reject) => {
               options.abortSignal?.addEventListener("abort", () =>
                  reject(new Error("cancelled settings read"))
               );
            });
         },
         { endpoint: R2_ENDPOINT, forcePathStyle: false }
      );
      try {
         const pending = streamUpload({
            client,
            bucket: "bucket",
            key: "report.txt",
            expectedETag: '"reviewed"',
            contentType: "text/plain",
            body,
            contentLength: 8,
            partSize: 5 * MIB,
            maxBytes: 10 * MIB,
            abortController: controller,
         });
         const rejected = expect(pending).rejects.toThrow(
            "cancelled settings read"
         );
         await started;
         body.destroy(new Error("connection lost"));
         await rejected;
         expect(controller.signal.aborted).toBe(true);
         expect(body.listenerCount("error")).toBe(0);
      } finally {
         body.destroy();
         client.destroy();
      }
   });

   it.each([8, 6 * MIB])(
      "preserves R2 metadata without unsupported AWS calls for %i bytes",
      async (size) => {
         const f = fixture();
         try {
            await f.run(size);
            expect(f.requests.filter((r) => r.method === "GET")).toHaveLength(
               0
            );
            const write = f.mutations()[0]!;
            expect(write.headers["x-amz-meta-owner"]).toBe("finance");
            expect(write.headers["cache-control"]).toBe("private, max-age=60");
            expect(write.headers["x-amz-tagging"]).toBeUndefined();
            expect(
               write.headers["x-amz-server-side-encryption"]
            ).toBeUndefined();
            expect(f.mutations().at(-1)!.headers["if-match"]).toBe(
               '"reviewed"'
            );
         } finally {
            f.client.destroy();
         }
      }
   );

   it("refuses only a customer-provided encryption key", async () => {
      const f = fixture({
         headers: {
            "x-amz-server-side-encryption-customer-algorithm": "AES256",
         },
      });
      try {
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.mutations()).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it.each<[Record<string, string>, Record<string, string | undefined>]>([
      [
         {
            "x-amz-server-side-encryption": "aws:kms",
            "x-amz-server-side-encryption-aws-kms-key-id": "key",
            "x-amz-server-side-encryption-bucket-key-enabled": "true",
         },
         {
            "x-amz-server-side-encryption": "aws:kms",
            "x-amz-server-side-encryption-aws-kms-key-id": "key",
            "x-amz-server-side-encryption-bucket-key-enabled": "true",
         },
      ],
      [
         { "x-amz-server-side-encryption": "aws:kms:dsse" },
         { "x-amz-server-side-encryption": "aws:kms:dsse" },
      ],
      [{ "content-encoding": "gzip" }, { "content-encoding": undefined }],
      [{ "x-amz-missing-meta": "1" }, { "x-amz-meta-owner": "finance" }],
      [
         { "x-amz-website-redirect-location": "/new-page" },
         { "x-amz-website-redirect-location": "/new-page" },
      ],
   ])(
      "replays stored settings on the replacement: %j",
      async (headers, sent) => {
         const f = fixture({ headers });
         try {
            await expect(f.run()).resolves.toMatchObject({
               eTag: '"replacement"',
            });
            const write = f.mutations()[0]!;
            for (const [header, value] of Object.entries(sent))
               expect(write.headers[header]).toBe(value);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("rejects a source mismatch even when HEAD ignores its condition", async () => {
      const f = fixture({ headers: { etag: '"changed"' } });
      try {
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.mutations()).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it("rechecks settings before a single PUT and leaves changed settings intact", async () => {
      const f = fixture({ changeAfterRead: true });
      try {
         await expect(f.run()).rejects.toMatchObject({ status: 409 });
         expect(f.mutations()).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });

   it("aborts multipart without publication when metadata changes mid-upload", async () => {
      const f = fixture({ changeAfterPart: true });
      try {
         await expect(f.run(6 * MIB)).rejects.toMatchObject({ status: 409 });
         expect(
            f
               .mutations()
               .some((r) => r.method === "POST" && "uploadId" in r.query)
         ).toBe(false);
         expect(f.mutations().at(-1)!.method).toBe("DELETE");
      } finally {
         f.client.destroy();
      }
   });
});

describe("replacements carry over tags and ACL grants where a provider has them", () => {
   const owner = "a".repeat(64);
   const acl = `<AccessControlPolicy><Owner><ID>${owner}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${owner}</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>`;

   const fixture = (endpoint: string, readable: boolean) => {
      const { client, requests } = s3Fixture(
         async (request: FixtureRequest) => {
            if (request.method === "HEAD")
               return empty(200, {
                  etag: '"reviewed"',
                  "content-length": "8",
                  "content-type": "text/plain",
               });
            if ("tagging" in request.query)
               return readable
                  ? reply(
                       200,
                       "<Tagging><TagSet><Tag><Key>access</Key><Value>private team</Value></Tag></TagSet></Tagging>"
                    )
                  : reply(403, errorXml("AccessDenied"));
            if ("acl" in request.query)
               return readable
                  ? reply(200, acl)
                  : reply(501, errorXml("NotImplemented"));
            return empty(200, { etag: '"replacement"' });
         },
         {
            endpoint,
            maxAttempts: 1,
            requestChecksumCalculation: "WHEN_REQUIRED",
         }
      );
      const run = () =>
         streamUpload({
            client,
            bucket: "bucket",
            key: "report.txt",
            expectedETag: '"reviewed"',
            contentType: "text/plain",
            body: Readable.from([Buffer.alloc(8, 41)]),
            contentLength: 8,
            partSize: 5 * MIB,
            maxBytes: 10 * MIB,
            abortController: new AbortController(),
         });
      return { client, requests, run };
   };

   it.each([
      AWS_ENDPOINT,
      MINIO_ENDPOINT,
      "https://s3.us-west-004.backblazeb2.com",
   ])("replays the reviewed tags and grants on %s", async (endpoint) => {
      const f = fixture(endpoint, true);
      try {
         await expect(f.run()).resolves.toMatchObject({
            eTag: '"replacement"',
         });
         const write = f.requests.find((r) => r.method === "PUT")!;
         expect(write.headers["x-amz-tagging"]).toBe("access=private%20team");
         expect(write.headers["x-amz-grant-full-control"]).toBe(
            `id="${owner}"`
         );
         expect(
            f.requests.filter((r) => "tagging" in r.query || "acl" in r.query)
         ).toHaveLength(2);
      } finally {
         f.client.destroy();
      }
   });

   it("replaces without them rather than refusing when neither can be read", async () => {
      const f = fixture(AWS_ENDPOINT, false);
      try {
         await expect(f.run()).resolves.toMatchObject({
            eTag: '"replacement"',
         });
         const write = f.requests.find((r) => r.method === "PUT")!;
         expect(write.headers["x-amz-tagging"]).toBeUndefined();
         expect(write.headers["x-amz-grant-full-control"]).toBeUndefined();
      } finally {
         f.client.destroy();
      }
   });
});

describe("parallel optional replacement reads", () => {
   it.each(["neither", "tags", "acl"])(
      "starts both reads before either settles when %s fails",
      async (failed) => {
         let settleTags!: () => void;
         let settleAcl!: () => void;
         const send = vi.fn(
            async (
               command: unknown,
               options: { abortSignal?: AbortSignal }
            ) => {
               expect(options.abortSignal).toBe(controller.signal);
               if (command instanceof HeadObjectCommand)
                  return { ETag: '"reviewed"' };
               if (command instanceof GetObjectTaggingCommand) {
                  await new Promise<void>((resolve) => {
                     settleTags = resolve;
                  });
                  if (failed === "tags") throw new Error("Tags unavailable");
                  return { TagSet: [{ Key: "team", Value: "one" }] };
               }
               if (command instanceof GetObjectAclCommand) {
                  await new Promise<void>((resolve) => {
                     settleAcl = resolve;
                  });
                  if (failed === "acl") throw new Error("ACL unavailable");
                  return {
                     Owner: { ID: "a".repeat(64) },
                     Grants: [
                        {
                           Permission: "READ",
                           Grantee: {
                              Type: "CanonicalUser",
                              ID: "a".repeat(64),
                           },
                        },
                     ],
                  };
               }
               throw new Error("Unexpected command");
            }
         );
         const controller = new AbortController();
         const pending = prepareUpload(
            {
               client: { send } as unknown as S3Client,
               bucket: "bucket",
               signal: controller.signal,
            },
            Provider.S3,
            {
               key: "file",
               expectedETag: '"reviewed"',
               contentType: "text/plain",
            }
         );
         await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(3));
         settleTags();
         settleAcl();
         const result = await pending;
         expect(result.attributes.Tagging).toBe(
            failed === "tags" ? undefined : "team=one"
         );
         expect(result.attributes.GrantRead).toBe(
            failed === "acl" ? undefined : `id="${"a".repeat(64)}"`
         );
      }
   );
});
