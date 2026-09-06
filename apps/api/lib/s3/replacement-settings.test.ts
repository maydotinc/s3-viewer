import { S3Client } from "@aws-sdk/client-s3";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { streamUpload } from "./upload";

const MIB = 1024 ** 2;
type Request = {
   method: string;
   query: Record<string, string>;
   headers: Record<string, string>;
};
const fixture = (
   options: {
      headers?: Record<string, string>;
      changeAfterPart?: boolean;
      changeAfterRead?: boolean;
      headConflict?: boolean;
   } = {}
) => {
   const requests: Request[] = [];
   let changed = false;
   let reads = 0;
   const client = new S3Client({
      endpoint: "https://test.r2.cloudflarestorage.com",
      region: "auto",
      forcePathStyle: true,
      maxAttempts: 1,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      requestHandler: {
         handle: async (request: Request) => {
            requests.push(request);
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
               if (options.headConflict) statusCode = 412;
            } else if ("uploads" in request.query) {
               body =
                  "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>";
            } else if ("partNumber" in request.query) {
               if (options.changeAfterPart) changed = true;
            } else if (
               request.method === "POST" &&
               "uploadId" in request.query
            ) {
               body =
                  '<CompleteMultipartUploadResult><ETag>"replacement"</ETag></CompleteMultipartUploadResult>';
            }
            return {
               response: {
                  statusCode,
                  headers,
                  body: Readable.from(body ? [body] : []),
               },
            };
         },
      },
   });
   const run = (size = 8) =>
      streamUpload({
         client,
         bucket: "bucket",
         key: "report.txt",
         expectedETag: '"reviewed"',
         contentType: "application/octet-stream",
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
      let begin!: () => void;
      const started = new Promise<void>((resolve) => {
         begin = resolve;
      });
      const client = new S3Client({
         endpoint: "https://test.r2.cloudflarestorage.com",
         region: "us-east-1",
         credentials: { accessKeyId: "test", secretAccessKey: "test" },
         requestHandler: {
            handle: (
               ...args: Parameters<
                  S3Client["config"]["requestHandler"]["handle"]
               >
            ) => {
               const options = args[1] as
                  | { abortSignal?: AbortSignal }
                  | undefined;
               begin();
               return new Promise((_resolve, reject) => {
                  options?.abortSignal?.addEventListener?.("abort", () =>
                     reject(new Error("cancelled settings read"))
                  );
               });
            },
         },
      });
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
   it.each<Record<string, string>>([
      {
         "x-amz-server-side-encryption": "aws:kms",
         "x-amz-server-side-encryption-aws-kms-key-id": "key",
      },
      { "x-amz-server-side-encryption": "aws:kms:dsse" },
      { "x-amz-server-side-encryption-customer-algorithm": "AES256" },
      { "content-encoding": "gzip" },
      { "x-amz-missing-meta": "1" },
   ])(
      "rejects unreadable or unsafe settings before mutation: %j",
      async (headers) => {
         const f = fixture({ headers });
         try {
            await expect(f.run()).rejects.toMatchObject({ status: 409 });
            expect(f.mutations()).toHaveLength(0);
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

describe("providers with mutable permissions cannot replace existing objects", () => {
   it.each(
      [
         "https://s3.us-east-1.amazonaws.com",
         "https://s3.eu-central-1.amazonaws.com",
         "https://minio.example.com",
      ].flatMap((endpoint) => [8, 6 * MIB].map((size) => ({ endpoint, size })))
   )(
      "refuses $size-byte replacement on $endpoint before storage requests or body reads",
      async ({ endpoint, size }) => {
         const handle = vi.fn();
         const client = new S3Client({
            endpoint,
            region: "us-east-1",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            requestHandler: { handle },
         });
         let reads = 0;
         const body = new Readable({
            read() {
               reads++;
               this.push(Buffer.alloc(size));
               this.push(null);
            },
         });
         try {
            await expect(
               streamUpload({
                  client,
                  bucket: "bucket",
                  key: "report.txt",
                  expectedETag: '"reviewed"',
                  contentType: "text/plain",
                  body,
                  contentLength: size,
                  partSize: 5 * MIB,
                  maxBytes: 10 * MIB,
                  abortController: new AbortController(),
               })
            ).rejects.toMatchObject({
               status: 409,
               message: expect.stringContaining("permission changes"),
            });
            expect(handle).not.toHaveBeenCalled();
            expect(reads).toBe(0);
         } finally {
            body.destroy();
            client.destroy();
         }
      }
   );
});
