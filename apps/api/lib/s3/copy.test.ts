import type { HeadObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { GIB, MAX_MULTIPART_PARTS, Provider } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import {
   PROVIDER_ENDPOINTS,
   empty,
   errorXml,
   reply,
   s3Fixture,
   xml,
   type FixtureReply,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import {
   MIN_COPY_PART_BYTES,
   copyObject,
   partRanges,
   type CopyRequest,
} from "./copy";

const BUCKET = "bucket";
const SOURCE = "reports/q3.csv";
const DEST = "reports/q4.csv";
const ETAG = '"reviewed"';

const COPIED = '<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>';

const clientFor = (
   endpoint: string,
   handle: (request: FixtureRequest) => Promise<FixtureReply>
) => s3Fixture(handle, { endpoint, maxAttempts: 1 }).client;

const sourceHead = (size: number) =>
   ({
      ETag: ETAG,
      ContentLength: size,
      $metadata: {},
   }) as HeadObjectCommandOutput;

const copy = (
   client: S3Client,
   provider: Provider,
   size = 12,
   extra: Partial<CopyRequest> = {}
) =>
   copyObject({ client, bucket: BUCKET }, provider, {
      sourceKey: SOURCE,
      destinationKey: DEST,
      source: sourceHead(size),
      sourceETag: ETAG,
      ...extra,
   });

const run = async (
   endpoint: string,
   provider: Provider,
   handle: (request: FixtureRequest) => Promise<FixtureReply>,
   size = 12,
   extra: Partial<CopyRequest> = {}
) => {
   const requests: FixtureRequest[] = [];
   const client = clientFor(endpoint, (request) => {
      requests.push(request);
      return handle(request);
   });
   try {
      return {
         requests,
         result: await copy(client, provider, size, extra).catch(
            (e: unknown) => e
         ),
      };
   } finally {
      client.destroy();
   }
};

const OWNER = "a".repeat(64);
const ACL = `<AccessControlPolicy><Owner><ID>${OWNER}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${OWNER}</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>`;
const OWNERSHIP =
   "<OwnershipControls><Rule><ObjectOwnership>ObjectWriter</ObjectOwnership></Rule></OwnershipControls>";

const emptyDestination = async (request: FixtureRequest) =>
   request.method === "HEAD"
      ? empty(404)
      : "acl" in request.query
        ? xml(ACL)
        : xml(COPIED);

describe("the destination condition reaches every provider", () => {
   it.each([
      ["MinIO", Provider.Other, PROVIDER_ENDPOINTS[Provider.Other]],
      ["B2", Provider.Other, PROVIDER_ENDPOINTS.B2],
      ["AWS S3", Provider.S3, PROVIDER_ENDPOINTS[Provider.S3]],
   ])(
      "sends if-none-match on the copy to %s",
      async (_name, provider, endpoint) => {
         const { requests, result } = await run(
            endpoint,
            provider,
            emptyDestination
         );
         expect(result).toMatchObject({ eTag: '"copied"' });
         const put = requests.find((r) => r.method === "PUT")!;
         expect(put.headers["if-none-match"]).toBe("*");
         expect(put.headers).not.toHaveProperty(
            "cf-copy-destination-if-none-match"
         );
      }
   );

   it("keeps R2 on its own destination condition", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.R2],
         Provider.R2,
         emptyDestination
      );
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["cf-copy-destination-if-none-match"]).toBe("*");
      expect(put.headers).not.toHaveProperty("if-none-match");
   });
});

describe("an unreadable destination blocks an unapproved replacement", () => {
   it.each([
      ["MinIO", PROVIDER_ENDPOINTS[Provider.Other]],
      ["B2", PROVIDER_ENDPOINTS.B2],
   ])(
      "refuses to guess when HEAD answers 403 on %s",
      async (_name, endpoint) => {
         const { requests, result } = await run(
            endpoint,
            Provider.Other,
            async (request) =>
               request.method === "HEAD" ? empty(403) : xml(COPIED)
         );
         expect(result).toMatchObject({ status: 403 });
         expect(requests.filter((r) => r.method !== "HEAD")).toEqual([]);
      }
   );

   it("still refuses a destination that HEAD confirms exists", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) =>
            request.method === "HEAD"
               ? empty(200, { etag: '"other"', "content-length": "1" })
               : xml(COPIED)
      );
      expect(result).toMatchObject({ status: 409 });
      expect(requests.filter((r) => r.method === "PUT")).toEqual([]);
   });
});

describe("a failed multipart copy waits for its siblings", () => {
   it("aborts only after every in-flight part has settled", async () => {
      const events: string[] = [];
      const { result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) => {
            if (request.method === "HEAD") return empty(404);
            if ("uploads" in request.query)
               return xml(
                  "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>"
               );
            const part = request.query.partNumber;
            if (part === "1") {
               events.push("part-1-failed");
               return reply(500, errorXml("InternalError"));
            }
            if (part === "2") {
               await new Promise((resolve) => setTimeout(resolve, 50));
               events.push("part-2-done");
               return xml(
                  '<CopyPartResult><ETag>"part"</ETag></CopyPartResult>'
               );
            }
            if (part)
               return xml(
                  '<CopyPartResult><ETag>"part"</ETag></CopyPartResult>'
               );
            if (request.method === "DELETE") {
               events.push("abort");
               return empty(204);
            }
            throw new Error(`unexpected ${request.method}`);
         },
         6 * GIB
      );
      expect(result).toMatchObject({ status: 502 });
      expect(events).toContain("abort");
      expect(events).toContain("part-2-done");
      expect(events.indexOf("abort")).toBeGreaterThan(
         events.indexOf("part-2-done")
      );
   });
});

describe("part sizing covers the whole provider range", () => {
   it("uses 512 MiB parts for an ordinary large object", () => {
      const ranges = partRanges(6 * GIB);
      expect(ranges).toHaveLength(12);
      expect(ranges[0]).toEqual({ start: 0, end: MIN_COPY_PART_BYTES - 1 });
      expect(ranges.at(-1)!.end).toBe(6 * GIB - 1);
   });

   it("grows the part size rather than exceeding the part limit", () => {
      const size = MAX_MULTIPART_PARTS * MIN_COPY_PART_BYTES + 1;
      const ranges = partRanges(size);
      expect(ranges.length).toBeLessThanOrEqual(MAX_MULTIPART_PARTS);
      expect(ranges[0]!.end - ranges[0]!.start + 1).toBeGreaterThan(
         MIN_COPY_PART_BYTES
      );
      expect(ranges.at(-1)!.end).toBe(size - 1);
   });

   it("keeps a 5 TiB object within the part limit", () => {
      expect(partRanges(5 * 1024 ** 4).length).toBeLessThanOrEqual(
         MAX_MULTIPART_PARTS
      );
   });
});

const MULTIPART =
   "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>";
const PART = '<CopyPartResult><ETag>"part"</ETag></CopyPartResult>';
const COMPLETED =
   '<CompleteMultipartUploadResult><ETag>"whole"</ETag></CompleteMultipartUploadResult>';

const multipartDestination = async (request: FixtureRequest) => {
   if (request.method === "HEAD") return empty(404);
   if ("ownershipControls" in request.query) return xml(OWNERSHIP);
   if ("uploads" in request.query) return xml(MULTIPART);
   if (request.query.partNumber) return xml(PART);
   if ("uploadId" in request.query) return xml(COMPLETED);
   return xml(COPIED);
};

const reviewedInPlace =
   (rest: (request: FixtureRequest) => Promise<FixtureReply>) =>
   async (request: FixtureRequest) =>
      request.method === "HEAD"
         ? empty(200, { etag: ETAG, "content-length": "1" })
         : rest(request);

describe("a copy can read from another bucket", () => {
   it("names the source bucket in the copy source", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         emptyDestination,
         12,
         { sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      expect(
         requests.find((r) => r.method === "PUT")!.headers["x-amz-copy-source"]
      ).toBe(`archive/${SOURCE}`);
   });

   it("keeps the source bucket on every copied part", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         multipartDestination,
         6 * GIB,
         { sourceBucket: "archive" }
      );
      const parts = requests.filter((r) => r.query.partNumber);
      expect(parts.length).toBeGreaterThan(0);
      for (const part of parts)
         expect(part.headers["x-amz-copy-source"]).toBe(`archive/${SOURCE}`);
   });
});

describe("a copy from a bucket in another region", () => {
   it.each([12, 6 * GIB])(
      "reads the source grants and tags through the source client (%i bytes)",
      async (size) => {
         const sourceRequests: FixtureRequest[] = [];
         const source = clientFor(
            "https://s3.us-east-1.amazonaws.com",
            async (request) => {
               sourceRequests.push(request);
               return "acl" in request.query ? xml(ACL) : xml(TAGGED);
            }
         );
         try {
            const { requests, result } = await run(
               "https://s3.eu-west-1.amazonaws.com",
               Provider.S3,
               async (request) =>
                  "acl" in request.query || "tagging" in request.query
                     ? empty(301)
                     : multipartDestination(request),
               size,
               { sourceBucket: "archive", sourceClient: source }
            );
            expect(result).toMatchObject({ size });
            expect(
               requests.filter((r) => "acl" in r.query || "tagging" in r.query)
            ).toEqual([]);
            expect(sourceRequests.map((r) => r.path)).toEqual(
               size > 5 * GIB
                  ? [`/archive/${SOURCE}`, `/archive/${SOURCE}`]
                  : [`/archive/${SOURCE}`]
            );
            const write = requests.find(
               (r) =>
                  (r.method === "PUT" && !r.query.partNumber) ||
                  "uploads" in r.query
            )!;
            expect(write.headers["x-amz-grant-full-control"]).toBe(
               `id="${OWNER}"`
            );
            if (size > 5 * GIB)
               expect(write.headers["x-amz-tagging"]).toBe("team=fin%20ops");
         } finally {
            source.destroy();
         }
      }
   );
});

describe("replacing settings on the object itself", () => {
   const settings = {
      ContentType: "text/csv",
      CacheControl: "max-age=60",
      Metadata: { owner: "finance" },
   };

   it("sends REPLACE with the new headers and reviewed destination condition", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async () => xml(COPIED),
         12,
         { destinationKey: SOURCE, settings }
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      expect(requests.filter((r) => r.method === "HEAD")).toEqual([]);
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["x-amz-metadata-directive"]).toBe("REPLACE");
      expect(put.headers["x-amz-copy-source-if-match"]).toBe(ETAG);
      expect(put.headers["if-match"]).toBe(ETAG);
      expect(put.headers["content-type"]).toBe("text/csv");
      expect(put.headers["cache-control"]).toBe("max-age=60");
      expect(put.headers["x-amz-meta-owner"]).toBe("finance");
      expect(put.headers).not.toHaveProperty("if-none-match");
   });

   it.each([false, true])(
      "protects an R2 settings rewrite when the destination changes: %s",
      async (replaceAfterSourceSelection) => {
         let stored = { eTag: ETAG, bytes: "reviewed content" };
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.R2],
            Provider.R2,
            async ({ headers }) => {
               expect(headers["x-amz-copy-source-if-match"]).toBe(stored.eTag);
               const selected = stored;
               if (replaceAfterSourceSelection)
                  stored = { eTag: '"replacement"', bytes: "new upload" };
               if (headers["cf-copy-destination-if-match"] !== stored.eTag)
                  return reply(412, errorXml("PreconditionFailed"));
               stored = selected;
               return xml(COPIED);
            },
            12,
            { destinationKey: SOURCE, settings }
         );
         expect(requests).toHaveLength(1);
         expect(requests[0]!.headers["cf-copy-destination-if-match"]).toBe(
            ETAG
         );
         if (replaceAfterSourceSelection) {
            expect(result).toMatchObject({ status: 409 });
            expect(stored).toEqual({
               eTag: '"replacement"',
               bytes: "new upload",
            });
         } else {
            expect(result).toMatchObject({ eTag: '"copied"' });
            expect(stored.bytes).toBe("reviewed content");
         }
      }
   );

   it("restates the settings and reviewed version on a compatible multipart initiation", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         reviewedInPlace(multipartDestination),
         6 * GIB,
         { destinationKey: SOURCE, settings }
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(
         requests.flatMap((r, index) => (r.method === "HEAD" ? [index] : []))
      ).toEqual([requests.length - 2]);
      const initiation = requests.find((r) => "uploads" in r.query)!;
      expect(initiation.headers["content-type"]).toBe("text/csv");
      expect(initiation.headers["x-amz-meta-owner"]).toBe("finance");
      expect(initiation.headers["if-match"]).toBe(ETAG);
      expect(initiation.headers).not.toHaveProperty("if-none-match");
   });
});

const TAGGED =
   "<Tagging><TagSet><Tag><Key>team</Key><Value>fin ops</Value></Tag></TagSet></Tagging>";

describe("tags on multipart copies", () => {
   const settings = { ContentType: "text/csv" };
   const tagged = async (request: FixtureRequest) =>
      "tagging" in request.query ? xml(TAGGED) : multipartDestination(request);

   it.each([
      ["a new key", {}],
      ["another bucket", { sourceBucket: "archive" }],
   ])("preserves readable tags when copying to %s", async (_name, extra) => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         tagged,
         6 * GIB,
         extra
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      const tagRead = requests.find((r) => "tagging" in r.query)!;
      const sourceBucket =
         "sourceBucket" in extra ? extra.sourceBucket : BUCKET;
      expect(tagRead.path).toBe(`/${sourceBucket}/${SOURCE}`);
      expect(
         requests.find((r) => "uploads" in r.query)!.headers["x-amz-tagging"]
      ).toBe("team=fin%20ops");
   });

   it.each([
      ["a new key", {}],
      ["a replacement key", { overwrite: true }],
   ])("keeps unreadable tags best effort for %s", async (_name, extra) => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) =>
            "tagging" in request.query
               ? empty(403)
               : multipartDestination(request),
         6 * GIB,
         extra
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(requests.filter((r) => "tagging" in r.query)).toHaveLength(1);
      expect(
         requests.find((r) => "uploads" in r.query)!.headers
      ).not.toHaveProperty("x-amz-tagging");
   });

   it("still refuses an in-place rewrite when tags cannot be read", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) =>
            "tagging" in request.query
               ? empty(403)
               : multipartDestination(request),
         6 * GIB,
         { destinationKey: SOURCE, settings }
      );
      expect(result).toMatchObject({ status: 403 });
      expect(requests.some((r) => "uploads" in r.query)).toBe(false);
   });

   it("restates the source tags on the initiation", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         reviewedInPlace(tagged),
         6 * GIB,
         { destinationKey: SOURCE, settings }
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(
         requests.find((r) => "uploads" in r.query)!.headers["x-amz-tagging"]
      ).toBe("team=fin%20ops");
   });

   it("asks R2, which has no object tags, for nothing", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.R2],
         Provider.R2,
         tagged,
         6 * GIB,
         {
            destinationKey: SOURCE,
            settings,
         }
      );
      expect(requests.filter((r) => "tagging" in r.query)).toEqual([]);
   });

   it("leaves a single-shot copy to its TaggingDirective", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         tagged,
         12,
         { destinationKey: SOURCE, settings }
      );
      expect(requests.filter((r) => "tagging" in r.query)).toEqual([]);
   });
});

const BAD_ACL = `<AccessControlPolicy><Owner><ID>${OWNER}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="AmazonCustomerByEmail"><EmailAddress>ana@example.com</EmailAddress></Grantee><Permission>READ</Permission></Grant></AccessControlList></AccessControlPolicy>`;

describe("grants that cannot be carried over", () => {
   const unreadable =
      (acl: () => FixtureReply) => async (request: FixtureRequest) =>
         request.method === "HEAD"
            ? empty(404)
            : "acl" in request.query
              ? acl()
              : xml(COPIED);

   it.each([
      ["a grantee it cannot represent", () => xml(BAD_ACL)],
      ["a refused read", () => empty(403)],
   ])("refuses to rewrite the object itself over %s", async (_name, acl) => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         unreadable(acl),
         12,
         { destinationKey: SOURCE, settings: { ContentType: "text/csv" } }
      );
      expect(result).toMatchObject({
         status: 409,
         message: expect.stringContaining("access permissions"),
      });
      expect(requests.filter((r) => r.method === "PUT")).toEqual([]);
   });

   it.each([
      ["a grantee it cannot represent", () => xml(BAD_ACL)],
      ["a refused read", () => empty(403)],
   ])("still copies to a new key over %s", async (_name, acl) => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         unreadable(acl)
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers).not.toHaveProperty("x-amz-grant-full-control");
   });
});

describe("encryption across buckets", () => {
   const encrypted = {
      ...sourceHead(12),
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "arn:aws:kms:us-east-1:1:key/abc",
      BucketKeyEnabled: true,
   } as HeadObjectCommandOutput;

   it("keeps the object's key when the copy stays in the bucket", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         emptyDestination,
         12,
         { source: encrypted }
      );
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["x-amz-server-side-encryption"]).toBe("aws:kms");
      expect(put.headers["x-amz-server-side-encryption-aws-kms-key-id"]).toBe(
         encrypted.SSEKMSKeyId
      );
   });

   it("lets the destination bucket's own default apply across buckets", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         emptyDestination,
         12,
         { source: encrypted, sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers).not.toHaveProperty("x-amz-server-side-encryption");
      expect(put.headers).not.toHaveProperty(
         "x-amz-server-side-encryption-aws-kms-key-id"
      );
      expect(put.headers).not.toHaveProperty(
         "x-amz-server-side-encryption-bucket-key-enabled"
      );
   });
});

const LIVE = '"live-destination"';

const occupied =
   (rest: (request: FixtureRequest) => Promise<FixtureReply>) =>
   async (request: FixtureRequest) =>
      request.method === "HEAD"
         ? empty(200, { etag: LIVE, "content-length": "1" })
         : "ownershipControls" in request.query
           ? xml(OWNERSHIP)
           : "acl" in request.query
             ? xml(ACL)
             : rest(request);

describe("an overwriting copy pins the version it replaces", () => {
   it.each([
      ["MinIO", Provider.Other, PROVIDER_ENDPOINTS[Provider.Other]],
      ["B2", Provider.Other, PROVIDER_ENDPOINTS.B2],
      ["AWS S3", Provider.S3, PROVIDER_ENDPOINTS[Provider.S3]],
   ])(
      "sends if-match on the live destination ETag to %s",
      async (_name, provider, endpoint) => {
         const { requests, result } = await run(
            endpoint,
            provider,
            occupied(async () => xml(COPIED)),
            12,
            { overwrite: true, sourceBucket: "archive" }
         );
         expect(result).toMatchObject({ eTag: '"copied"' });
         expect(requests.filter((r) => r.method === "HEAD")).toHaveLength(1);
         const put = requests.find((r) => r.method === "PUT")!;
         expect(put.headers["if-match"]).toBe(LIVE);
         expect(put.headers["x-amz-copy-source-if-match"]).toBe(ETAG);
         expect(put.headers).not.toHaveProperty("if-none-match");
      }
   );

   it("keeps R2 on its own destination condition", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.R2],
         Provider.R2,
         occupied(async () => xml(COPIED)),
         12,
         { overwrite: true, sourceBucket: "archive" }
      );
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["cf-copy-destination-if-match"]).toBe(LIVE);
      expect(put.headers).not.toHaveProperty("if-match");
      expect(put.headers).not.toHaveProperty(
         "cf-copy-destination-if-none-match"
      );
   });

   it.each([
      [
         "the standard header",
         Provider.Other,
         PROVIDER_ENDPOINTS[Provider.Other],
         "if-none-match",
      ],
      [
         "R2's own header",
         Provider.R2,
         PROVIDER_ENDPOINTS[Provider.R2],
         "cf-copy-destination-if-none-match",
      ],
   ])(
      "falls back to a create condition through %s when nothing is there",
      async (_name, provider, endpoint, header) => {
         const { requests, result } = await run(
            endpoint,
            provider,
            emptyDestination,
            12,
            { overwrite: true, sourceBucket: "archive" }
         );
         expect(result).toMatchObject({ eTag: '"copied"' });
         const put = requests.find((r) => r.method === "PUT")!;
         expect(put.headers[header]).toBe("*");
         expect(put.headers).not.toHaveProperty("if-match");
      }
   );

   it("refuses to guess when the destination cannot be read", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) =>
            request.method === "HEAD" ? empty(403) : xml(COPIED),
         12,
         { overwrite: true, sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ status: 403 });
      expect(requests.filter((r) => r.method === "PUT")).toEqual([]);
   });

   it("conditions a non-AWS multipart copy on its initiation", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         occupied(multipartDestination),
         6 * GIB,
         { overwrite: true, sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      const initiation = requests.find((r) => "uploads" in r.query)!;
      expect(initiation.headers["if-match"]).toBe(LIVE);
      expect(initiation.headers).not.toHaveProperty("if-none-match");
   });

   it("conditions an AWS multipart copy on its completion", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         occupied(multipartDestination),
         6 * GIB,
         { overwrite: true, sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      const initiation = requests.find((r) => "uploads" in r.query)!;
      expect(initiation.headers).not.toHaveProperty("if-match");
      const completion = requests.find(
         (r) => r.method === "POST" && "uploadId" in r.query
      )!;
      expect(completion.headers["if-match"]).toBe(LIVE);
   });

   it("keeps a settings rewrite pinned to the reviewed version even with overwrite enabled", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async () => xml(COPIED),
         12,
         {
            destinationKey: SOURCE,
            overwrite: true,
            settings: { ContentType: "text/csv" },
         }
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      expect(requests.filter((r) => r.method === "HEAD")).toEqual([]);
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["if-match"]).toBe(ETAG);
      expect(put.headers).not.toHaveProperty("if-none-match");
      expect(put.headers["x-amz-copy-source-if-match"]).toBe(ETAG);
   });

   it("still refuses an occupied destination when overwrite is off", async () => {
      const { result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) =>
            request.method === "HEAD"
               ? empty(200, { etag: '"other"', "content-length": "1" })
               : xml(COPIED),
         12,
         { sourceBucket: "archive" }
      );
      expect(result).toMatchObject({ status: 409 });
   });
});

describe("a reviewed destination ETag replaces only that version", () => {
   const REVIEWED = '"what-the-user-saw"';

   const reviewed =
      (rest: (request: FixtureRequest) => Promise<FixtureReply>) =>
      async (request: FixtureRequest) =>
         request.method === "HEAD"
            ? empty(200, { etag: REVIEWED, "content-length": "1" })
            : occupied(rest)(request);

   it.each([
      ["MinIO", Provider.Other, PROVIDER_ENDPOINTS[Provider.Other]],
      ["B2", Provider.Other, PROVIDER_ENDPOINTS.B2],
      ["AWS S3", Provider.S3, PROVIDER_ENDPOINTS[Provider.S3]],
   ])(
      "sends if-match on the caller's ETag to %s",
      async (_name, provider, endpoint) => {
         const { requests, result } = await run(
            endpoint,
            provider,
            reviewed(async () => xml(COPIED)),
            12,
            { destinationETag: REVIEWED }
         );
         expect(result).toMatchObject({ eTag: '"copied"' });
         const put = requests.find((r) => r.method === "PUT")!;
         expect(put.headers["if-match"]).toBe(REVIEWED);
         expect(put.headers).not.toHaveProperty("if-none-match");
      }
   );

   it("looks the destination up again only where storage ignores if-match", async () => {
      const heads = async (provider: Provider) => {
         const { requests } = await run(
            PROVIDER_ENDPOINTS[provider],
            provider,
            reviewed(async () => xml(COPIED)),
            12,
            { destinationETag: REVIEWED, sourceBucket: "archive" }
         );
         return requests.filter((r) => r.method === "HEAD").map((r) => r.path);
      };
      expect(await heads(Provider.S3)).toEqual([]);
      expect(await heads(Provider.Other)).toEqual([`/${BUCKET}/${DEST}`]);
   });

   it("refuses a newer destination on storage that ignores if-match", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS.B2,
         Provider.Other,
         occupied(async () => xml(COPIED)),
         12,
         { destinationETag: REVIEWED }
      );
      expect(result).toMatchObject({ status: 409 });
      expect(requests.filter((r) => r.method === "PUT")).toEqual([]);
   });

   it("keeps R2 on its own destination condition", async () => {
      const { requests } = await run(
         PROVIDER_ENDPOINTS[Provider.R2],
         Provider.R2,
         occupied(async () => xml(COPIED)),
         12,
         { destinationETag: REVIEWED }
      );
      const put = requests.find((r) => r.method === "PUT")!;
      expect(put.headers["cf-copy-destination-if-match"]).toBe(REVIEWED);
      expect(put.headers).not.toHaveProperty("if-match");
   });

   it("reports the storage refusal when that version is gone", async () => {
      const { result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         occupied(async () => empty(412)),
         12,
         { destinationETag: REVIEWED }
      );
      expect(result).toMatchObject({ status: 409 });
   });
});

describe("a multipart copy needs every part's ETag", () => {
   it("refuses to assemble parts storage returned without an ETag and aborts the copy", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) => {
            if (request.method === "HEAD") return empty(404);
            if ("uploads" in request.query) return xml(MULTIPART);
            if (request.query.partNumber)
               return xml("<CopyPartResult></CopyPartResult>");
            if (request.method === "DELETE") return empty(204);
            return xml(COMPLETED);
         },
         6 * GIB
      );
      expect(result).toMatchObject({
         status: 502,
         message: "Storage returned no part ETag.",
      });
      expect(requests.some((r) => r.method === "DELETE")).toBe(true);
      expect(
         requests.filter((r) => r.method === "POST" && "uploadId" in r.query)
      ).toEqual([]);
   });
});

describe("a multipart copy that cannot be aborted", () => {
   it("logs the abandoned upload instead of dropping it silently", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
      try {
         const { result } = await run(
            PROVIDER_ENDPOINTS[Provider.Other],
            Provider.Other,
            async (request) => {
               if (request.method === "HEAD") return empty(404);
               if ("uploads" in request.query) return xml(MULTIPART);
               if (request.query.partNumber)
                  return reply(500, errorXml("InternalError"));
               if (request.method === "DELETE")
                  return reply(403, errorXml("AccessDenied"));
               throw new Error(`unexpected ${request.method}`);
            },
            6 * GIB
         );
         expect(result).toHaveProperty("status", 502);
         expect(warn).toHaveBeenCalledWith(
            "Multipart upload could not be aborted",
            expect.objectContaining({ bucket: BUCKET })
         );
      } finally {
         warn.mockRestore();
      }
   });
});

describe("multipart copy revision safety", () => {
   it.each([200, 409, 412])(
      "pins settings completion when storage answers %s",
      async (status) => {
         let currentETag = ETAG;
         let parts = 0;
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.S3],
            Provider.S3,
            async (request) => {
               if ("acl" in request.query) return xml(ACL);
               if ("tagging" in request.query) return xml(TAGGED);
               if ("uploads" in request.query) return xml(MULTIPART);
               if (request.query.partNumber) {
                  expect(request.headers["x-amz-copy-source-if-match"]).toBe(
                     ETAG
                  );
                  if (++parts === 12 && status !== 200) currentETag = '"newer"';
                  return xml(PART);
               }
               if (request.method === "DELETE") return empty(204);
               expect(request.headers["if-match"]).toBe(ETAG);
               if (request.headers["if-match"] !== currentETag)
                  return empty(status);
               currentETag = '"whole"';
               return xml(COMPLETED);
            },
            6 * GIB,
            { destinationKey: SOURCE, settings: { ContentType: "text/csv" } }
         );
         expect(parts).toBe(12);
         if (status === 200) {
            expect(result).toMatchObject({ eTag: '"whole"' });
            expect(currentETag).toBe('"whole"');
         } else {
            expect(result).toMatchObject({ status: 409 });
            expect(currentETag).toBe('"newer"');
            expect(
               requests.filter((request) => request.method === "DELETE")
            ).toHaveLength(1);
         }
      }
   );

   it.each([
      {},
      { destinationKey: SOURCE, settings: { ContentType: "text/csv" } },
   ])(
      "refuses unsupported R2 multipart operations before starting",
      async (extra) => {
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.R2],
            Provider.R2,
            multipartDestination,
            6 * GIB,
            extra
         );
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("larger than 5 GiB"),
         });
         expect(requests).toHaveLength(0);
      }
   );
});

describe("a compatible multipart copy re-checks the destination before completing", () => {
   const PARTS = 12;
   const withDestination = (
      live: () => FixtureReply
   ): ((request: FixtureRequest) => Promise<FixtureReply>) => {
      let parts = 0;
      return async (request) => {
         if (request.method === "HEAD")
            return parts < PARTS ? empty(404) : live();
         if (request.method === "DELETE") return empty(204);
         if (request.query.partNumber) parts++;
         return multipartDestination(request);
      };
   };
   const completions = (requests: FixtureRequest[]) =>
      requests.filter((r) => r.method === "POST" && "uploadId" in r.query);
   const aborts = (requests: FixtureRequest[]) =>
      requests.filter((r) => r.method === "DELETE");

   it("publishes a new key that is still free", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         withDestination(() => empty(404)),
         6 * GIB
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(requests.at(-2)!.method).toBe("HEAD");
      expect(completions(requests)).toHaveLength(1);
   });

   it("discards the copy when the new key was taken during the part copies", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         withDestination(() =>
            empty(200, { etag: '"uploaded-meanwhile"', "content-length": "1" })
         ),
         6 * GIB
      );
      expect(result).toMatchObject({ status: 409 });
      expect(completions(requests)).toEqual([]);
      expect(aborts(requests)).toHaveLength(1);
   });

   it.each([
      ["was replaced", () => empty(200, { etag: '"newer"' })],
      ["was deleted", () => empty(404)],
   ])(
      "discards an overwrite when the version it pinned %s",
      async (_name, later) => {
         let parts = 0;
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.Other],
            Provider.Other,
            async (request) => {
               if (request.method === "HEAD")
                  return parts < PARTS
                     ? empty(200, { etag: LIVE, "content-length": "1" })
                     : later();
               if (request.method === "DELETE") return empty(204);
               if (request.query.partNumber) parts++;
               return multipartDestination(request);
            },
            6 * GIB,
            { overwrite: true }
         );
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("original changed"),
         });
         expect(completions(requests)).toEqual([]);
         expect(aborts(requests)).toHaveLength(1);
      }
   );

   it("still overwrites a destination whose HEAD carries no ETag to compare", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) => {
            if (request.method === "HEAD")
               return empty(200, { "content-length": "1" });
            return multipartDestination(request);
         },
         6 * GIB,
         { overwrite: true }
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(completions(requests)).toHaveLength(1);
      expect(aborts(requests)).toEqual([]);
   });

   it("discards a settings rewrite when the object changed after the last part", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.Other],
         Provider.Other,
         async (request) => {
            if (request.method === "HEAD")
               return empty(200, { etag: '"newer"', "content-length": "1" });
            if (request.method === "DELETE") return empty(204);
            return multipartDestination(request);
         },
         6 * GIB,
         { destinationKey: SOURCE, settings: { ContentType: "text/csv" } }
      );
      expect(result).toMatchObject({ status: 409 });
      expect(completions(requests)).toEqual([]);
      expect(aborts(requests)).toHaveLength(1);
   });

   it("leaves AWS to its conditional completion", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         async (request) =>
            "acl" in request.query
               ? xml(ACL)
               : "tagging" in request.query
                 ? xml("<Tagging><TagSet/></Tagging>")
                 : multipartDestination(request),
         6 * GIB
      );
      expect(result).toMatchObject({ eTag: '"whole"' });
      expect(requests.filter((r) => r.method === "HEAD")).toEqual([]);
      expect(completions(requests)[0]!.headers["if-none-match"]).toBe("*");
   });
});

describe("uncertain destination HEAD failures", () => {
   it.each([403, 429, 503, "TimeoutError", "AbortError"])(
      "never writes after %s",
      async (failure) => {
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.Other],
            Provider.Other,
            async () => {
               if (typeof failure === "number") return empty(failure);
               throw Object.assign(new Error(failure), { name: failure });
            }
         );
         expect(result).toHaveProperty("status");
         expect(requests.map((request) => request.method)).toEqual(["HEAD"]);
      }
   );
});

const READER = "b".repeat(64);
const ACL_WITH_READER = `<AccessControlPolicy><Owner><ID>${OWNER}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${OWNER}</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${READER}</ID></Grantee><Permission>READ</Permission></Grant></AccessControlList></AccessControlPolicy>`;

describe("destination ownership during cross-bucket copies", () => {
   type Ownership =
      | "BucketOwnerEnforced"
      | "BucketOwnerPreferred"
      | "ObjectWriter"
      | "missing"
      | "denied"
      | "failed";
   const failure = (status: number, code: string) =>
      reply(status, `<Error><Code>${code}</Code></Error>`);
   const owned =
      (
         ownership: Ownership,
         options: { acl?: string; denyAcl?: boolean; rejectCopy?: boolean } = {}
      ) =>
      async (request: FixtureRequest) => {
         if ("ownershipControls" in request.query) {
            if (ownership === "missing")
               return failure(404, "OwnershipControlsNotFoundError");
            if (ownership === "denied") return failure(403, "AccessDenied");
            if (ownership === "failed") return failure(500, "InternalError");
            return xml(
               `<OwnershipControls><Rule><ObjectOwnership>${ownership}</ObjectOwnership></Rule></OwnershipControls>`
            );
         }
         if ("acl" in request.query)
            return options.denyAcl
               ? failure(403, "AccessDenied")
               : xml(options.acl ?? ACL_WITH_READER);
         if ("tagging" in request.query)
            return xml("<Tagging><TagSet/></Tagging>");
         if (
            ownership === "BucketOwnerEnforced" &&
            grantHeaders(request).length > 0
         )
            return failure(400, "AccessControlListNotSupported");
         if (options.rejectCopy && request.method === "PUT")
            return failure(412, "PreconditionFailed");
         return multipartDestination(request);
      };
   const grantHeaders = (request: FixtureRequest) =>
      Object.keys(request.headers).filter((name) =>
         name.startsWith("x-amz-grant-")
      );
   const crossBucket = { sourceBucket: "archive" };

   it.each([12, 6 * GIB])(
      "omits source grants for ACL-disabled destinations (%i bytes)",
      async (size) => {
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.S3],
            Provider.S3,
            owned("BucketOwnerEnforced"),
            size,
            crossBucket
         );
         expect(result).toMatchObject({ size });
         expect(
            requests.find((r) => "ownershipControls" in r.query)?.path
         ).toBe(`/${BUCKET}/`);
         expect(requests.some((r) => "acl" in r.query)).toBe(false);
         const writes = requests.filter(
            (r) => r.method === "PUT" || r.method === "POST"
         );
         expect(writes.length).toBeGreaterThan(0);
         for (const write of writes) expect(grantHeaders(write)).toEqual([]);
         expect(writes.at(-1)?.headers["if-none-match"]).toBe("*");
      }
   );

   it.each<Ownership>(["BucketOwnerPreferred", "ObjectWriter", "missing"])(
      "preserves readable source grants when destination ownership is %s",
      async (ownership) => {
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.S3],
            Provider.S3,
            owned(ownership),
            12,
            crossBucket
         );
         expect(result).toMatchObject({ eTag: '"copied"' });
         expect(requests.find((r) => "acl" in r.query)?.path).toBe(
            `/archive/${SOURCE}`
         );
         const write = requests.find((r) => r.method === "PUT")!;
         expect(write.headers["x-amz-grant-read"]).toBe(`id="${READER}"`);
         expect(write.headers["x-amz-grant-full-control"]).toBe(
            `id="${OWNER}"`
         );
      }
   );

   it("uses destination defaults when restricted IAM hides ownership settings", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         owned("denied"),
         12,
         crossBucket
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      expect(requests.some((r) => "acl" in r.query)).toBe(false);
      expect(
         requests.find((r) => r.method === "PUT")?.headers
      ).not.toHaveProperty("x-amz-grant-read");
   });

   it("does not turn failed ownership reads into writes", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         owned("failed"),
         12,
         crossBucket
      );
      expect(result).toMatchObject({ status: 502 });
      expect(requests).toHaveLength(1);
   });

   it("leaves same-bucket owner-only grants intact without requiring ownership permission", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         owned("denied", { acl: ACL }),
         12,
         { destinationKey: SOURCE, settings: { ContentType: "text/plain" } }
      );
      expect(result).toMatchObject({ eTag: '"copied"' });
      expect(requests.some((r) => "ownershipControls" in r.query)).toBe(false);
      expect(
         requests.find((r) => r.method === "PUT")?.headers[
            "x-amz-grant-full-control"
         ]
      ).toBe(`id="${OWNER}"`);
   });

   it("still refuses an in-place rewrite when source grants cannot be preserved", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         owned("denied", { denyAcl: true }),
         12,
         { destinationKey: SOURCE, settings: { ContentType: "text/plain" } }
      );
      expect(result).toMatchObject({ status: 409 });
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe("GET");
   });

   it("sends the grants and the create condition on the one write storage refuses", async () => {
      const { requests, result } = await run(
         PROVIDER_ENDPOINTS[Provider.S3],
         Provider.S3,
         owned("ObjectWriter", { rejectCopy: true }),
         12,
         crossBucket
      );
      expect(result).toMatchObject({ status: 409 });
      const writes = requests.filter((r) => r.method === "PUT");
      expect(writes).toHaveLength(1);
      expect(writes[0]?.headers["if-none-match"]).toBe("*");
      expect(writes[0]?.headers["x-amz-grant-read"]).toBe(`id="${READER}"`);
   });
});

describe("website redirects survive every server-side copy", () => {
   it.each(
      [12, 6 * GIB].flatMap((size) => [
         { size, extra: {}, label: "rename" },
         {
            size,
            extra: { sourceBucket: "archive" },
            label: "cross-bucket copy",
         },
         {
            size,
            extra: {
               destinationKey: SOURCE,
               settings: { ContentType: "text/csv" },
            },
            label: "settings edit",
         },
      ])
   )(
      "preserves the redirect for a $size-byte $label",
      async ({ size, extra }) => {
         const { requests, result } = await run(
            PROVIDER_ENDPOINTS[Provider.S3],
            Provider.S3,
            async (request) => {
               if ("acl" in request.query) return xml(ACL);
               if ("tagging" in request.query) return xml(TAGGED);
               return multipartDestination(request);
            },
            size,
            {
               ...extra,
               source: {
                  ...sourceHead(size),
                  WebsiteRedirectLocation: "/new-page",
               },
            }
         );
         expect(result).toMatchObject({ size });
         const write = requests.find((request) =>
            size > 5 * GIB
               ? "uploads" in request.query
               : request.method === "PUT"
         );
         expect(write?.headers["x-amz-website-redirect-location"]).toBe(
            "/new-page"
         );
      }
   );
});
