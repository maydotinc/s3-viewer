import { S3_ROUTE_TIMEOUT_MS, copyDeadlineMs } from "@/lib/constants";
import type { S3Client } from "@aws-sdk/client-s3";
import { GIB, Provider } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import {
   PROVIDER_ENDPOINTS,
   empty,
   errorXml,
   reply,
   s3Fixture,
   xml,
   type FixtureHandle,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { headReviewed } from "./object-metadata";
import {
   PartialRenameError,
   moveObjects,
   partialCopies,
   renameObject,
} from "./rename";

const BUCKET = "bucket";
const SOURCE = "folder/report %.csv";
const DEST = "folder/renamed %.csv";
const ETAG = '"reviewed"';
const OWNER = "a".repeat(64);

const ACL = `<AccessControlPolicy><Owner><ID>${OWNER}</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>${OWNER}</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>`;
const TAGGED =
   "<Tagging><TagSet><Tag><Key>team</Key><Value>fin ops</Value></Tag></TagSet></Tagging>";

type World = {
   source: {
      etag: string;
      size: number;
      extra?: Record<string, string>;
   } | null;
   destination?: boolean;
   copyStatus?: number;
   deleteStatus?: number;
   deleteLands?: boolean;
   aclStatus?: number;
   taggingStatus?: number;
};

const keyOf = (request: FixtureRequest): string =>
   decodeURIComponent(request.path).slice(`/${BUCKET}/`.length);

const world = (state: World) => {
   const requests: FixtureRequest[] = [];
   const handle = async (request: FixtureRequest) => {
      requests.push(request);
      const key = keyOf(request);
      const source = key === SOURCE;
      if (request.method === "HEAD") {
         if (source && !state.source) return empty(404);
         if (!source && !state.destination) return empty(404);
         if (!source)
            return empty(200, { etag: '"other"', "content-length": "1" });
         const { etag, size, extra } = state.source!;
         if (
            request.headers["if-match"] &&
            request.headers["if-match"] !== etag
         )
            return empty(412);
         return empty(200, {
            etag,
            "content-length": String(size),
            ...extra,
         });
      }
      if (request.method === "GET" && "acl" in request.query)
         return state.aclStatus
            ? reply(state.aclStatus, errorXml("AccessDenied"))
            : xml(ACL);
      if (request.method === "GET" && "tagging" in request.query)
         return state.taggingStatus
            ? reply(state.taggingStatus, errorXml("AccessDenied"))
            : xml(TAGGED);
      if (request.method === "POST" && "uploads" in request.query)
         return xml(
            "<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>"
         );
      if (request.method === "PUT" && request.query.partNumber)
         return xml('<CopyPartResult><ETag>"part"</ETag></CopyPartResult>');
      if (request.method === "POST" && request.query.uploadId)
         return xml(
            '<CompleteMultipartUploadResult><ETag>"copied"</ETag></CompleteMultipartUploadResult>'
         );
      if (request.method === "PUT")
         return state.copyStatus
            ? reply(state.copyStatus, errorXml("PreconditionFailed"))
            : xml('<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>');
      if (request.method === "DELETE") {
         if (state.deleteStatus) {
            if (state.deleteLands) state.source = null;
            return reply(state.deleteStatus, errorXml("InternalError"));
         }
         state.source = null;
         return empty(204);
      }
      throw new Error(`unexpected ${request.method} ${request.path}`);
   };
   return { requests, handle };
};

const clientFor = (endpoint: string, handle: FixtureHandle) =>
   s3Fixture(handle, { endpoint, maxAttempts: 1 }).client;

const run = async (
   provider: Provider,
   endpoint: string,
   state: World,
   act: (client: S3Client) => Promise<unknown> = async (client) => {
      const scope = { client, bucket: BUCKET };
      return renameObject(scope, provider, {
         objectKey: SOURCE,
         newObjectKey: DEST,
         source: await headReviewed(scope, SOURCE, ETAG),
         sourceETag: ETAG,
      });
   }
) => {
   const { requests, handle } = world(state);
   const client = clientFor(endpoint, handle);
   try {
      return { requests, state, result: await act(client).catch((e) => e) };
   } finally {
      client.destroy();
   }
};

const summarise = (requests: FixtureRequest[]) =>
   requests.map((r) => `${r.method} ${keyOf(r)}`);

const providers = [
   {
      name: "AWS S3",
      provider: Provider.S3,
      endpoint: PROVIDER_ENDPOINTS[Provider.S3],
   },
   {
      name: "R2",
      provider: Provider.R2,
      endpoint: PROVIDER_ENDPOINTS[Provider.R2],
   },
   { name: "B2", provider: Provider.Other, endpoint: PROVIDER_ENDPOINTS.B2 },
   {
      name: "MinIO",
      provider: Provider.Other,
      endpoint: PROVIDER_ENDPOINTS[Provider.Other],
   },
] as const;

describe("rename copies then deletes on every provider", () => {
   it("uses one conditional copy and one conditional delete on AWS S3", async () => {
      const { requests, result, state } = await run(
         Provider.S3,
         PROVIDER_ENDPOINTS[Provider.S3],
         { source: { etag: ETAG, size: 12 } }
      );
      expect(result).toBeUndefined();
      expect(state.source).toBeNull();
      expect(summarise(requests)).toEqual([
         `HEAD ${SOURCE}`,
         `GET ${SOURCE}`,
         `PUT ${DEST}`,
         `DELETE ${SOURCE}`,
      ]);
      const [head, , copy, remove] = requests as [
         FixtureRequest,
         FixtureRequest,
         FixtureRequest,
         FixtureRequest,
      ];
      expect(head.headers["if-match"]).toBe(ETAG);
      expect(decodeURIComponent(copy.headers["x-amz-copy-source"] ?? "")).toBe(
         `${BUCKET}/${SOURCE}`
      );
      expect(copy.headers["x-amz-copy-source-if-match"]).toBe(ETAG);
      expect(copy.headers["if-none-match"]).toBe("*");
      expect(copy.headers["x-amz-metadata-directive"]).toBe("COPY");
      expect(copy.headers["x-amz-grant-full-control"]).toContain(OWNER);
      expect(remove.headers["if-match"]).toBe(ETAG);
   });

   it.each(providers.filter(({ provider }) => provider !== Provider.S3))(
      "checks the destination and re-checks the source before deleting on $name",
      async ({ provider, endpoint }) => {
         const { requests, result, state } = await run(provider, endpoint, {
            source: { etag: ETAG, size: 12 },
         });
         expect(result).toBeUndefined();
         expect(state.source).toBeNull();
         expect(summarise(requests)).toEqual([
            `HEAD ${SOURCE}`,
            `HEAD ${DEST}`,
            `PUT ${DEST}`,
            `HEAD ${SOURCE}`,
            `DELETE ${SOURCE}`,
         ]);
         const copy = requests[2]!;
         const remove = requests[4]!;
         expect(copy.headers["x-amz-copy-source-if-match"]).toBe(ETAG);
         expect(remove.headers).not.toHaveProperty("if-match");
         expect(remove.headers).not.toHaveProperty("if-none-match");
         expect(requests[3]!.headers["if-match"]).toBe(ETAG);
         expect(requests.some((r) => "acl" in r.query)).toBe(false);
      }
   );

   it("sends R2's own destination condition and no AWS-only one", async () => {
      const { requests } = await run(
         Provider.R2,
         PROVIDER_ENDPOINTS[Provider.R2],
         {
            source: { etag: ETAG, size: 12 },
         }
      );
      const copy = requests[2]!;
      expect(copy.headers["cf-copy-destination-if-none-match"]).toBe("*");
      expect(copy.headers).not.toHaveProperty("if-none-match");
   });

   it.each(providers)(
      "refuses a source that changed before the copy on $name",
      async ({ provider, endpoint }) => {
         const { requests, result } = await run(provider, endpoint, {
            source: { etag: '"changed"', size: 12 },
         });
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("changed"),
         });
         expect(summarise(requests)).toEqual([`HEAD ${SOURCE}`]);
      }
   );

   it.each(providers)(
      "refuses an occupied destination without writing on $name",
      async ({ provider, endpoint }) => {
         const { requests, result } = await run(provider, endpoint, {
            source: { etag: ETAG, size: 12 },
            destination: true,
            copyStatus: 412,
         });
         expect(result).toMatchObject({ status: 409 });
         expect(requests.filter((r) => r.method === "DELETE")).toEqual([]);
      }
   );

   it.each(providers)(
      "keeps both files and reports a partial rename on $name",
      async ({ provider, endpoint }) => {
         const { requests, result, state } = await run(provider, endpoint, {
            source: { etag: ETAG, size: 12 },
            deleteStatus: 500,
         });
         expect(result).toBeInstanceOf(PartialRenameError);
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("could not be removed"),
         });
         expect(state.source).not.toBeNull();
         expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
         expect(summarise(requests).at(-1)).toBe(`HEAD ${SOURCE}`);
      }
   );

   it.each(providers)(
      "treats a timed-out delete that landed as success on $name",
      async ({ provider, endpoint }) => {
         const { result, state } = await run(provider, endpoint, {
            source: { etag: ETAG, size: 12 },
            deleteStatus: 500,
            deleteLands: true,
         });
         expect(result).toBeUndefined();
         expect(state.source).toBeNull();
      }
   );

   it.each(providers.filter(({ provider }) => provider !== Provider.R2))(
      "copies an object over 5 GiB in parts on $name",
      async ({ provider, endpoint }) => {
         const { requests, result } = await run(provider, endpoint, {
            source: { etag: ETAG, size: 6 * GIB },
         });
         expect(result).toBeUndefined();
         const parts = requests.filter((r) => r.query.partNumber);
         expect(parts).toHaveLength(12);
         expect(parts[0]!.headers["x-amz-copy-source-range"]).toBe(
            `bytes=0-${536870912 - 1}`
         );
         expect(parts.at(-1)!.headers["x-amz-copy-source-range"]).toBe(
            `bytes=${6 * GIB - 536870912}-${6 * GIB - 1}`
         );
         expect(
            requests.some((r) => r.method === "POST" && "uploads" in r.query)
         ).toBe(true);
         expect(
            requests.find((r) => "uploads" in r.query)!.headers["x-amz-tagging"]
         ).toBe("team=fin%20ops");
         expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
      }
   );

   it("requires part source conditions and refuses unsafe R2 multipart rename", async () => {
      const on = await run(Provider.Other, PROVIDER_ENDPOINTS[Provider.Other], {
         source: { etag: ETAG, size: 6 * GIB },
      });
      const off = await run(Provider.R2, PROVIDER_ENDPOINTS[Provider.R2], {
         source: { etag: ETAG, size: 6 * GIB },
      });
      const part = (requests: FixtureRequest[]) =>
         requests.find((r) => r.query.partNumber)!.headers;
      expect(part(on.requests)["x-amz-copy-source-if-match"]).toBe(ETAG);
      expect(off.result).toMatchObject({ status: 409 });
      expect(summarise(off.requests)).toEqual([`HEAD ${SOURCE}`]);
      expect(
         on.requests.find((r) => "uploads" in r.query)!.headers["if-none-match"]
      ).toBe("*");
   });

   it.each(providers)(
      "refuses to copy an SSE-C object on $name",
      async ({ provider, endpoint }) => {
         const { requests, result } = await run(provider, endpoint, {
            source: {
               etag: ETAG,
               size: 12,
               extra: {
                  "x-amz-server-side-encryption-customer-algorithm": "AES256",
               },
            },
         });
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("customer key"),
         });
         expect(summarise(requests)).toEqual([`HEAD ${SOURCE}`]);
      }
   );

   it("renames without ACL headers when the grants cannot be read", async () => {
      const { requests, result } = await run(
         Provider.S3,
         PROVIDER_ENDPOINTS[Provider.S3],
         { source: { etag: ETAG, size: 12 }, aclStatus: 403 }
      );
      expect(result).toBeUndefined();
      const copy = requests.find((r) => r.method === "PUT")!;
      expect(copy.headers).not.toHaveProperty("x-amz-grant-full-control");
   });
});

describe("moveObjects", () => {
   it.each([undefined, 403])(
      "carries readable tags through a large move and tolerates tag read status %s",
      async (taggingStatus) => {
         const { requests, result, state } = await run(
            Provider.Other,
            PROVIDER_ENDPOINTS[Provider.Other],
            { source: { etag: ETAG, size: 6 * GIB }, taggingStatus },
            (client) =>
               moveObjects({ client, bucket: BUCKET }, Provider.Other, [
                  { key: SOURCE, newKey: DEST, expectedETag: ETAG },
               ])
         );
         expect(result).toEqual({ moved: [SOURCE], failed: [] });
         expect(state.source).toBeNull();
         const initiation = requests.find((r) => "uploads" in r.query)!;
         expect(initiation.headers["x-amz-tagging"]).toBe(
            taggingStatus === undefined ? "team=fin%20ops" : undefined
         );
         expect(requests.at(-1)!.method).toBe("DELETE");
      }
   );

   it("moves each key and reports per-key failures", async () => {
      const { requests, handle } = world({ source: null });
      const objects = [
         { key: "a.txt", newKey: "b/a.txt", expectedETag: ETAG },
         { key: "gone.txt", newKey: "b/gone.txt", expectedETag: ETAG },
      ];
      const present = new Set(["a.txt"]);
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.S3],
         async (request) => {
            const key = keyOf(request);
            requests.push(request);
            if (request.method === "HEAD")
               return present.has(key)
                  ? empty(200, { etag: ETAG, "content-length": "3" })
                  : empty(404);
            if (request.method === "GET" && "acl" in request.query)
               return xml(ACL);
            if (request.method === "PUT")
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            present.delete(key);
            return empty(204);
         }
      );
      try {
         expect(
            await moveObjects({ client, bucket: BUCKET }, Provider.S3, objects)
         ).toEqual({
            moved: ["a.txt"],
            failed: [
               {
                  key: "gone.txt",
                  message: "Object not found",
                  retryable: false,
               },
            ],
         });
      } finally {
         client.destroy();
      }
      void handle;
   });

   it("reads the live ETag when the caller has none", async () => {
      const seen: FixtureRequest[] = [];
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.Other],
         async (request) => {
            seen.push(request);
            const key = keyOf(request);
            if (request.method === "HEAD")
               return key === "a.txt"
                  ? empty(200, { etag: '"live"', "content-length": "3" })
                  : empty(404);
            if (request.method === "PUT")
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            return empty(204);
         }
      );
      try {
         expect(
            await moveObjects({ client, bucket: BUCKET }, Provider.Other, [
               { key: "a.txt", newKey: "b.txt", expectedETag: null },
            ])
         ).toEqual({ moved: ["a.txt"], failed: [] });
      } finally {
         client.destroy();
      }
      expect(
         seen.filter((r) => r.method === "HEAD" && r.headers["if-match"])
      ).toHaveLength(1);
      expect(
         seen.filter((r) => r.method === "HEAD" && keyOf(r) === "a.txt")
      ).toHaveLength(2);
      expect(seen[0]!.headers["if-match"]).toBeUndefined();
      expect(
         seen.find((r) => r.method === "PUT")!.headers[
            "x-amz-copy-source-if-match"
         ]
      ).toBe('"live"');
   });

   it("refuses a null-ETag move when storage has no ETag", async () => {
      const seen: FixtureRequest[] = [];
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.S3],
         async (request) => {
            seen.push(request);
            return empty(200, { "content-length": "3" });
         }
      );
      try {
         expect(
            await moveObjects({ client, bucket: BUCKET }, Provider.S3, [
               { key: "a.txt", newKey: "b.txt", expectedETag: null },
            ])
         ).toMatchObject({
            moved: [],
            failed: [
               { key: "a.txt", message: expect.stringContaining("no ETag") },
            ],
         });
         expect(seen).toHaveLength(1);
      } finally {
         client.destroy();
      }
   });

   it("retains a replacement discovered before an unconditional provider delete", async () => {
      let sourceReads = 0;
      const seen: FixtureRequest[] = [];
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.Other],
         async (request) => {
            seen.push(request);
            if (request.method === "HEAD")
               return keyOf(request) === "a.txt"
                  ? empty(200, {
                       etag: ++sourceReads === 1 ? '"live"' : '"replaced"',
                       "content-length": "3",
                    })
                  : empty(404);
            if (request.method === "PUT")
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            throw new Error("Must not delete the replacement");
         }
      );
      try {
         expect(
            await moveObjects({ client, bucket: BUCKET }, Provider.Other, [
               { key: "a.txt", newKey: "b.txt", expectedETag: null },
            ])
         ).toMatchObject({
            moved: [],
            failed: [
               { message: expect.stringContaining("could not be removed") },
            ],
         });
         expect(seen.some((request) => request.method === "DELETE")).toBe(
            false
         );
      } finally {
         client.destroy();
      }
   });

   it("moves a full selection with a bounded number of requests in flight", async () => {
      let active = 0;
      let maximum = 0;
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.S3],
         async (request) => {
            active++;
            maximum = Math.max(maximum, active);
            await new Promise<void>((resolve) => setImmediate(resolve));
            active--;
            if (request.method === "HEAD")
               return empty(200, { etag: ETAG, "content-length": "3" });
            if (request.method === "GET" && "acl" in request.query)
               return xml(ACL);
            if (request.method === "PUT")
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            return empty(204);
         }
      );
      try {
         const result = await moveObjects(
            { client, bucket: BUCKET },
            Provider.S3,
            Array.from({ length: 40 }, (_, i) => ({
               key: `${i}.txt`,
               newKey: `moved/${i}.txt`,
               expectedETag: ETAG,
            }))
         );
         expect(result.failed).toEqual([]);
         expect(result.moved).toHaveLength(40);
         expect(maximum).toBeGreaterThan(1);
         expect(maximum).toBeLessThanOrEqual(8);
      } finally {
         client.destroy();
      }
   });

   it("runs each copy on a deadline sized to its own bytes, still tied to the batch", async () => {
      const timer = vi.spyOn(globalThis, "setTimeout");
      const batch = new AbortController();
      let copySignal: AbortSignal | undefined;
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.Other],
         async (request, options) => {
            if (request.method === "HEAD")
               return keyOf(request) === "a.txt"
                  ? empty(200, {
                       etag: ETAG,
                       "content-length": String(2 * GIB),
                    })
                  : empty(404);
            if (request.method === "PUT") {
               copySignal = options?.abortSignal;
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            }
            return empty(204);
         }
      );
      try {
         const result = await moveObjects(
            { client, bucket: BUCKET, signal: batch.signal },
            Provider.Other,
            [{ key: "a.txt", newKey: "b.txt", expectedETag: ETAG }]
         );
         expect(result).toEqual({ moved: ["a.txt"], failed: [] });
         const deadline = copyDeadlineMs(2 * GIB);
         expect(deadline).toBeGreaterThan(S3_ROUTE_TIMEOUT_MS);
         expect(timer).toHaveBeenCalledWith(expect.any(Function), deadline);
      } finally {
         client.destroy();
         timer.mockRestore();
      }
      expect(copySignal).toBeDefined();
      expect(copySignal).not.toBe(batch.signal);
      expect(copySignal!.aborted).toBe(false);
      batch.abort();
      expect(copySignal!.aborted).toBe(true);
   });

   it("bounds each source HEAD by the route timeout, still tied to the batch", async () => {
      const timer = vi.spyOn(globalThis, "setTimeout");
      const batch = new AbortController();
      let headSignal: AbortSignal | undefined;
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.Other],
         async (request, options) => {
            if (request.method === "HEAD" && keyOf(request) === "a.txt") {
               headSignal ??= options?.abortSignal;
               return empty(200, { etag: ETAG, "content-length": "4" });
            }
            if (request.method === "HEAD") return empty(404);
            if (request.method === "PUT")
               return xml(
                  '<CopyObjectResult><ETag>"c"</ETag></CopyObjectResult>'
               );
            return empty(204);
         }
      );
      try {
         const result = await moveObjects(
            { client, bucket: BUCKET, signal: batch.signal },
            Provider.Other,
            [{ key: "a.txt", newKey: "b.txt", expectedETag: ETAG }]
         );
         expect(result).toEqual({ moved: ["a.txt"], failed: [] });
         expect(timer.mock.calls[0]?.[1]).toBe(S3_ROUTE_TIMEOUT_MS);
      } finally {
         client.destroy();
         timer.mockRestore();
      }
      expect(headSignal).toBeDefined();
      expect(headSignal).not.toBe(batch.signal);
      expect(headSignal!.aborted).toBe(false);
      batch.abort();
      expect(headSignal!.aborted).toBe(true);
   });

   it("stops starting work once the request is aborted", async () => {
      const controller = new AbortController();
      const client = clientFor(PROVIDER_ENDPOINTS[Provider.Other], async () => {
         controller.abort();
         return empty(404);
      });
      try {
         const result = await moveObjects(
            { client, bucket: BUCKET, signal: controller.signal },
            Provider.Other,
            Array.from({ length: 32 }, (_, i) => ({
               key: `${i}.txt`,
               newKey: `moved/${i}.txt`,
               expectedETag: ETAG,
            }))
         );
         expect(result.moved).toEqual([]);
         expect(
            result.failed.filter(({ message }) => message.includes("cancelled"))
               .length
         ).toBeGreaterThan(0);
      } finally {
         client.destroy();
      }
   });
});

describe("moving slash-ending object keys", () => {
   it.each(["", "payload that must survive"])(
      "preserves the exact body and metadata: %j",
      async (body) => {
         const sourceKey = "raw/data/";
         const destinationKey = "moved/data/";
         const metadata = {
            owner: "finance",
            purpose: "retained even on empty objects",
         };
         const stored = new Map([[sourceKey, { body, metadata, eTag: ETAG }]]);
         const requests: FixtureRequest[] = [];
         const client = clientFor(
            PROVIDER_ENDPOINTS[Provider.S3],
            async (request) => {
               requests.push(request);
               const key = keyOf(request);
               const object = stored.get(key);
               if (request.method === "HEAD")
                  return object
                     ? empty(200, {
                          etag: object.eTag,
                          "content-length": String(
                             Buffer.byteLength(object.body)
                          ),
                          "x-amz-meta-owner": object.metadata.owner,
                          "x-amz-meta-purpose": object.metadata.purpose,
                       })
                     : empty(404);
               if (request.method === "GET" && "acl" in request.query)
                  return xml(ACL);
               if (request.method === "PUT") {
                  expect(request.headers["x-amz-copy-source"]).toBe(
                     `${BUCKET}/${sourceKey}`
                  );
                  expect(request.headers["x-amz-copy-source-if-match"]).toBe(
                     ETAG
                  );
                  expect(request.headers["x-amz-metadata-directive"]).toBe(
                     "COPY"
                  );
                  expect(request.headers["if-none-match"]).toBe("*");
                  stored.set(key, {
                     ...stored.get(sourceKey)!,
                     eTag: '"copied"',
                  });
                  return xml(
                     '<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>'
                  );
               }
               if (request.method === "DELETE") {
                  expect(stored.get(destinationKey)).toEqual({
                     body,
                     metadata,
                     eTag: '"copied"',
                  });
                  expect(request.headers["if-match"]).toBe(object?.eTag);
                  stored.delete(key);
                  return empty(204);
               }
               throw new Error(`Unexpected ${request.method}`);
            }
         );
         try {
            expect(
               await moveObjects({ client, bucket: BUCKET }, Provider.S3, [
                  {
                     key: sourceKey,
                     newKey: destinationKey,
                     expectedETag: ETAG,
                  },
               ])
            ).toEqual({ moved: [sourceKey], failed: [] });
            expect(stored.has(sourceKey)).toBe(false);
            expect(stored.get(destinationKey)).toEqual({
               body,
               metadata,
               eTag: '"copied"',
            });
            expect(
               requests.filter((request) => request.method === "PUT")
            ).toHaveLength(1);
         } finally {
            client.destroy();
         }
      }
   );

   it.each([
      "changed before head",
      "changed before copy",
      "destination exists",
      "changed before delete",
   ])("retains the source when %s", async (scenario) => {
      const sourceKey = "raw/data/";
      let sourceETag = scenario === "changed before head" ? '"new"' : ETAG;
      const requests: FixtureRequest[] = [];
      const client = clientFor(
         PROVIDER_ENDPOINTS[Provider.S3],
         async (request) => {
            requests.push(request);
            if (request.method === "HEAD")
               return empty(200, { etag: sourceETag, "content-length": "12" });
            if (request.method === "GET" && "acl" in request.query)
               return xml(ACL);
            if (request.method === "PUT") {
               if (scenario === "changed before copy") sourceETag = '"new"';
               if (
                  scenario === "destination exists" ||
                  sourceETag !== request.headers["x-amz-copy-source-if-match"]
               )
                  return reply(412, errorXml("PreconditionFailed"));
               if (scenario === "changed before delete") sourceETag = '"new"';
               return xml(
                  '<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>'
               );
            }
            if (request.method === "DELETE") {
               expect(request.headers["if-match"]).not.toBe(sourceETag);
               return reply(412, errorXml("PreconditionFailed"));
            }
            throw new Error(`Unexpected ${request.method}`);
         }
      );
      try {
         const result = await moveObjects(
            { client, bucket: BUCKET },
            Provider.S3,
            [{ key: sourceKey, newKey: "moved/data/", expectedETag: ETAG }]
         );
         expect(result).toMatchObject({
            moved: [],
            failed: [{ key: sourceKey, retryable: false }],
         });
         if (scenario !== "changed before delete")
            expect(
               requests.some((request) => request.method === "DELETE")
            ).toBe(false);
         expect(partialCopies(result)).toEqual(
            scenario === "changed before delete" ? [sourceKey] : []
         );
      } finally {
         client.destroy();
      }
   });
});
