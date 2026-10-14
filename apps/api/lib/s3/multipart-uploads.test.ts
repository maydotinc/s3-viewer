import { CLEANUP_TIMEOUT_MS } from "@/lib/constants";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTENT_TYPE, Provider } from "@s3-viewer/types";
import {
   AWS_ENDPOINT,
   MINIO_ENDPOINT,
   empty,
   reply,
   s3Fixture,
   type FixtureReply,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import {
   abortForCleanup,
   abortMultipartUpload,
   abortMultipartUploads,
   completeUpload,
   createUpload,
   listMultipartUploads,
   listUploadedParts,
   listUploadsInFolders,
   openUploadId,
   sealListedUpload,
   sealUploadId,
   streamPart,
} from "./multipart-uploads";
import {
   StorageStalledError,
   UploadIdleError,
   stallMsFor,
} from "./progress-floor";
import { readBudget, withReadUser } from "./read-budget";
import { installReadBudget } from "./read-budget.fixture";
import { resetRequestBudgets, withRequestBudget } from "./request-budget";

const SERVER = "server12345";
const KEY = "videos/a.mp4";
const bound = (key = KEY) => ({ serverId: SERVER, bucket: "bucket", key });

const seal = (
   uploadId: string,
   partSize: number,
   replacement?: { expectedETag: string; settingsDigest: string },
   key = KEY
): string => {
   const sealed = sealUploadId(uploadId, partSize, bound(key), replacement);
   if (!sealed) throw new Error("expected a sealed upload id");
   return sealed;
};

const listed = (uploadId: string, key = `videos/${uploadId}.mp4`): string => {
   const sealed = sealListedUpload(uploadId, bound(key));
   if (!sealed) throw new Error("expected a listed upload id");
   return sealed;
};

const error = (statusCode: number, code: string) =>
   reply(
      statusCode,
      `<Error><Code>${code}</Code><Message>${code}</Message></Error>`
   );

const uploadsPage = (
   uploads: string[],
   markers?: { key: string; uploadId: string },
   keyOf = (id: string) => `videos/${id}.mp4`
) =>
   reply(
      200,
      `<?xml version="1.0" encoding="UTF-8"?><ListMultipartUploadsResult>` +
         `<Bucket>bucket</Bucket><IsTruncated>${Boolean(markers)}</IsTruncated>` +
         (markers
            ? `<NextKeyMarker>${markers.key}</NextKeyMarker><NextUploadIdMarker>${markers.uploadId}</NextUploadIdMarker>`
            : "") +
         uploads
            .map(
               (id) =>
                  `<Upload><Key>${keyOf(id)}</Key><UploadId>${id}</UploadId>` +
                  `<Initiated>2026-09-01T10:00:00.000Z</Initiated><StorageClass>STANDARD</StorageClass>` +
                  `<Initiator><ID>arn:aws:iam::1:user/ana</ID><DisplayName>ana</DisplayName></Initiator></Upload>`
            )
            .join("") +
         `</ListMultipartUploadsResult>`
   );

const fixture = (
   handle: (request: FixtureRequest) => Promise<FixtureReply>,
   endpoint = MINIO_ENDPOINT
) =>
   s3Fixture(
      async (request, { abortSignal: signal }) => {
         if (!signal) return handle(request);
         return Promise.race([
            handle(request),
            new Promise<never>((_resolve, reject) => {
               // the NodeHttpHandler rejects with its own abort error, not the signal's reason.
               const abort = () => {
                  const error = new Error("FixtureRequest aborted");
                  error.name = "AbortError";
                  reject(error);
               };
               if (signal.aborted) {
                  abort();
                  return;
               }
               signal.addEventListener("abort", abort, { once: true });
            }),
         ]);
      },
      { endpoint }
   );

describe("listing incomplete multipart uploads", () => {
   it.each([
      "https://s3.us-east-1.amazonaws.com",
      "https://account.r2.cloudflarestorage.com",
      "https://s3.us-west-004.backblazeb2.com",
   ])(
      "sends the prefix to a documented compatible endpoint: %s",
      async (endpoint) => {
         const f = fixture(async () => uploadsPage(["u1"]), endpoint);
         try {
            const page = await listMultipartUploads(f.scope, SERVER, {
               prefix: "videos/",
            });
            expect(f.requests[0]?.query).toMatchObject({ prefix: "videos/" });
            expect(page.uploads.map((upload) => upload.uploadId)).toEqual([
               listed("u1"),
            ]);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      "https://minio.example.com",
      "https://storage.example.com",
      "https://s3.us-west-004.backblazeb2.com.attacker.example",
   ])("filters locally for an unknown endpoint: %s", async (endpoint) => {
      const f = fixture(
         async () =>
            uploadsPage(["u1", "u2"], undefined, (id) =>
               id === "u2" ? "other/u2.mp4" : `videos/${id}.mp4`
            ),
         endpoint
      );
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "videos/",
         });
         expect(f.requests[0]?.query).not.toHaveProperty("prefix");
         expect(page.uploads.map((upload) => upload.key)).toEqual([
            "videos/u1.mp4",
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it("starts a locally filtered listing just before the prefix", async () => {
      const f = fixture(async () => uploadsPage(["u1"]));
      try {
         await listMultipartUploads(f.scope, SERVER, { prefix: "videos/" });
         await listMultipartUploads(f.scope, SERVER, {
            prefix: "videos/",
            keyMarker: "videos/u1.mp4",
            uploadIdMarker: "u1",
         });
         await listMultipartUploads(f.scope, SERVER, { prefix: "" });
         expect(f.requests.map(({ query }) => query["key-marker"])).toEqual([
            "videos",
            "videos/u1.mp4",
            undefined,
         ]);
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      { next: "videos/u9.mp4", more: true },
      { next: "videos-old/u9.mp4", more: true },
      { next: "zebra/u9.mp4", more: false },
   ])(
      "pages a locally filtered listing only while it can still reach the prefix: $next",
      async ({ next, more }) => {
         const f = fixture(async () =>
            uploadsPage(["u1", "u9"], { key: next, uploadId: "u9" }, (id) =>
               id === "u9" ? next : `videos/${id}.mp4`
            )
         );
         try {
            const page = await listMultipartUploads(f.scope, SERVER, {
               prefix: "videos/",
            });
            expect(page.uploads.map(({ key }) => key)).toContain(
               "videos/u1.mp4"
            );
            expect(page.nextKeyMarker).toBe(more ? next : null);
            expect(page.nextUploadIdMarker).toBe(more ? "u9" : null);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("keeps paging an unfiltered listing to the end of the bucket", async () => {
      const f = fixture(async () =>
         uploadsPage(
            ["u1"],
            { key: "zebra/u9.mp4", uploadId: "u9" },
            () => "zebra/u9.mp4"
         )
      );
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "",
         });
         expect(page.nextKeyMarker).toBe("zebra/u9.mp4");
         expect(page.nextUploadIdMarker).toBe("u9");
      } finally {
         f.client.destroy();
      }
   });

   it("avoids walking unrelated B2 uploads when the service applies Prefix", async () => {
      const f = fixture(async (request) => {
         if (request.query.prefix === "videos/") return uploadsPage(["wanted"]);
         return uploadsPage(
            ["unrelated"],
            { key: "other/unrelated", uploadId: "unrelated" },
            () => "other/unrelated"
         );
      }, "https://s3.us-west-004.backblazeb2.com");
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "videos/",
         });
         expect(page.uploads.map((upload) => upload.key)).toEqual([
            "videos/wanted.mp4",
         ]);
         expect(page.nextKeyMarker).toBeNull();
         expect(f.requests).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("asks for one page and maps every upload", async () => {
      const f = fixture(async () => uploadsPage(["u1", "u2"]));
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "videos/",
         });
         expect(f.requests[0]?.query).toMatchObject({
            uploads: "",
            "max-uploads": "1000",
         });
         expect(page).toEqual({
            uploads: [
               {
                  key: "videos/u1.mp4",
                  uploadId: listed("u1"),
                  initiated: "2026-09-01T10:00:00.000Z",
                  storageClass: "STANDARD",
               },
               {
                  key: "videos/u2.mp4",
                  uploadId: listed("u2"),
                  initiated: "2026-09-01T10:00:00.000Z",
                  storageClass: "STANDARD",
               },
            ],
            nextKeyMarker: null,
            nextUploadIdMarker: null,
         });
      } finally {
         f.client.destroy();
      }
   });

   it("sends the markers it was given and returns the next pair", async () => {
      const f = fixture(async () =>
         uploadsPage(["u3"], { key: "videos/u3.mp4", uploadId: "u3" })
      );
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "",
            keyMarker: "videos/u2.mp4",
            uploadIdMarker: "u2",
         });
         expect(f.requests[0]?.query).toMatchObject({
            "key-marker": "videos/u2.mp4",
            "upload-id-marker": "u2",
         });
         expect(f.requests[0]?.query).not.toHaveProperty("prefix");
         expect(page).toMatchObject({
            nextKeyMarker: "videos/u3.mp4",
            nextUploadIdMarker: "u3",
         });
      } finally {
         f.client.destroy();
      }
   });

   it("falls back to the last row when a gateway omits the markers", async () => {
      const truncated = reply(
         200,
         `<?xml version="1.0" encoding="UTF-8"?><ListMultipartUploadsResult>` +
            `<Bucket>bucket</Bucket><IsTruncated>true</IsTruncated>` +
            `<Upload><Key>videos/u1.mp4</Key><UploadId>u1</UploadId></Upload>` +
            `<Upload><Key>videos/u2.mp4</Key><UploadId>u2</UploadId></Upload>` +
            `</ListMultipartUploadsResult>`
      );
      const f = fixture(async () => truncated);
      try {
         expect(
            await listMultipartUploads(f.scope, SERVER, { prefix: "" })
         ).toMatchObject({
            nextKeyMarker: "videos/u2.mp4",
            nextUploadIdMarker: "u2",
         });
      } finally {
         f.client.destroy();
      }
   });

   it("reports an unreachable bucket as an http error", async () => {
      const f = fixture(async () => error(403, "AccessDenied"));
      try {
         await expect(
            listMultipartUploads(f.scope, SERVER, { prefix: "" })
         ).rejects.toMatchObject({ status: 403 });
      } finally {
         f.client.destroy();
      }
   });
});

const byBytes = (a: string, b: string) =>
   Buffer.compare(Buffer.from(a), Buffer.from(b));

// a bucket whose listing honours the prefix and both markers, a page at a time.
const uploadsIn = (
   keys: string[],
   { pageSize = 1000, prefixes = true, idMarkers = true } = {}
) => {
   const uploads = keys
      .map((key) => ({ key, id: `id-${key}` }))
      .sort((a, b) => byBytes(a.key, b.key));
   return fixture(
      async ({ query }) => {
         const marker = query["key-marker"] ?? "";
         const idMarker = query["upload-id-marker"];
         const after = uploads.filter(
            ({ key, id }) =>
               key.startsWith(query.prefix ?? "") &&
               (byBytes(key, marker) > 0 ||
                  (key === marker && idMarker !== undefined && id > idMarker))
         );
         const page = after.slice(0, pageSize);
         const last = page.at(-1);
         const truncated = after.length > page.length;
         return reply(
            200,
            `<?xml version="1.0" encoding="UTF-8"?><ListMultipartUploadsResult>` +
               `<IsTruncated>${truncated}</IsTruncated>` +
               (truncated && last
                  ? `<NextKeyMarker>${last.key}</NextKeyMarker>` +
                    (idMarkers
                       ? `<NextUploadIdMarker>${last.id}</NextUploadIdMarker>`
                       : "")
                  : "") +
               page
                  .map(
                     ({ key, id }) =>
                        `<Upload><Key>${key}</Key><UploadId>${id}</UploadId></Upload>`
                  )
                  .join("") +
               `</ListMultipartUploadsResult>`
         );
      },
      prefixes ? AWS_ENDPOINT : MINIO_ENDPOINT
   );
};

const walkFolders = async (
   f: ReturnType<typeof fixture>,
   folders: string[],
   prefix = ""
) => {
   const keys: string[] = [];
   const markers: string[] = [];
   let keyMarker: string | undefined;
   let uploadIdMarker: string | undefined;
   for (let pages = 0; pages < 100; pages++) {
      const page = await listUploadsInFolders(f.scope, SERVER, folders, {
         prefix,
         keyMarker,
         uploadIdMarker,
      });
      keys.push(...page.uploads.map(({ key }) => key));
      if (page.nextKeyMarker === null) return { keys, markers, done: true };
      markers.push(page.nextKeyMarker);
      keyMarker = page.nextKeyMarker;
      uploadIdMarker = page.nextUploadIdMarker ?? undefined;
   }
   return { keys, markers, done: false };
};

const FOLDERED_BUCKET = [
   "a b/1",
   "a-b/1",
   "a.b/1",
   "a/1",
   "a/2",
   "a/deep/3",
   "aa/1",
   "private/x",
   "z/1",
   "é/1",
];

describe.each([
   ["an endpoint that filters by prefix", true],
   ["an endpoint listed bucket-wide", false],
])("listing uploads inside folders on %s", (_kind, prefixes) => {
   it.each([1, 2, 1000])(
      "finds every upload in the folders and nothing else, %i to a page",
      async (pageSize) => {
         const f = uploadsIn(FOLDERED_BUCKET, { pageSize, prefixes });
         try {
            const { keys, done } = await walkFolders(f, ["a/", "z/", "é/"]);
            expect(done).toBe(true);
            expect(keys).toEqual(["a/1", "a/2", "a/deep/3", "z/1", "é/1"]);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      [["data/", "data-archive/"]],
      [["a/", "a-b/"]],
      [["a/", "a.b/", "a b/", "a-b/"]],
   ])(
      "reaches the end when one folder's name extends another's: %j",
      async (folders) => {
         const f = uploadsIn(
            [...FOLDERED_BUCKET, "data-archive/x", "data/y", "data.old/z"],
            { pageSize: 1, prefixes }
         );
         try {
            const { keys, done } = await walkFolders(f, folders);
            expect(done).toBe(true);
            expect([...keys].sort()).toEqual(
               [...FOLDERED_BUCKET, "data-archive/x", "data/y"]
                  .filter((key) =>
                     folders.some((folder) => key.startsWith(folder))
                  )
                  .sort()
            );
            expect(new Set(keys).size).toBe(keys.length);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("only ever hands back a marker inside the caller's folders", async () => {
      const f = uploadsIn(FOLDERED_BUCKET, { pageSize: 1, prefixes });
      try {
         const folders = ["a/", "z/"];
         const { markers } = await walkFolders(f, folders);
         expect(markers.length).toBeGreaterThan(0);
         for (const marker of markers)
            expect(folders.some((folder) => marker.startsWith(folder))).toBe(
               true
            );
      } finally {
         f.client.destroy();
      }
   });

   it("passes over empty folders within one request", async () => {
      const f = uploadsIn(FOLDERED_BUCKET, { prefixes });
      try {
         const page = await listUploadsInFolders(
            f.scope,
            SERVER,
            ["empty-1/", "empty-2/", "empty-3/", "z/"],
            { prefix: "" }
         );
         expect(page).toEqual({
            uploads: [expect.objectContaining({ key: "z/1" })],
            nextKeyMarker: null,
            nextUploadIdMarker: null,
         });
      } finally {
         f.client.destroy();
      }
   });

   it("narrows to a prefix inside a folder, including a name typed halfway", async () => {
      const f = uploadsIn(FOLDERED_BUCKET, { prefixes });
      try {
         await expect(walkFolders(f, ["a/"], "a/de")).resolves.toMatchObject({
            keys: ["a/deep/3"],
         });
         await expect(walkFolders(f, ["a/"], "a/")).resolves.toMatchObject({
            keys: ["a/1", "a/2", "a/deep/3"],
         });
      } finally {
         f.client.destroy();
      }
   });

   it("shows nothing for a prefix outside the folders or a marker outside them", async () => {
      const f = uploadsIn(FOLDERED_BUCKET, { prefixes });
      try {
         await expect(
            walkFolders(f, ["a/"], "private/")
         ).resolves.toMatchObject({ keys: [], done: true });
         f.requests.length = 0;
         await expect(
            listUploadsInFolders(f.scope, SERVER, ["a/"], {
               prefix: "",
               keyMarker: "private/x",
            })
         ).resolves.toEqual({
            uploads: [],
            nextKeyMarker: null,
            nextUploadIdMarker: null,
         });
         expect(f.requests).toEqual([]);
      } finally {
         f.client.destroy();
      }
   });
});

describe("listing uploads inside folders on an endpoint listed bucket-wide", () => {
   it("skips unrelated uploads before the folder without revealing them", async () => {
      // "m-…" sorts after "m" and before "m/", so the walk starts among them.
      const strays = Array.from({ length: 5 }, (_, i) => `m-${i}/secret`);
      const f = uploadsIn([...strays, "m/mine"], {
         pageSize: 1,
         prefixes: false,
      });
      try {
         const { keys, markers, done } = await walkFolders(f, ["m/"]);
         expect(done).toBe(true);
         expect(keys).toEqual(["m/mine"]);
         for (const marker of markers)
            expect(marker.startsWith("m/")).toBe(true);
      } finally {
         f.client.destroy();
      }
   });

   it("gives up clearly rather than loop when too many unrelated uploads come first", async () => {
      const strays = Array.from(
         { length: 25 },
         (_, i) => `m-${String(i).padStart(2, "0")}/secret`
      );
      const f = uploadsIn([...strays, "m/mine"], {
         pageSize: 1,
         prefixes: false,
      });
      try {
         await expect(
            listUploadsInFolders(f.scope, SERVER, ["m/"], { prefix: "" })
         ).rejects.toMatchObject({ status: 503 });
      } finally {
         f.client.destroy();
      }
   });
});

describe("listing uploads inside folders on a gateway that leaves out upload id markers", () => {
   it("still moves past a page that ends on an upload named like the folder", async () => {
      const f = uploadsIn(["m/", "m/a", "m/b"], {
         pageSize: 1,
         idMarkers: false,
      });
      try {
         const { keys, done } = await walkFolders(f, ["m/"]);
         expect(done).toBe(true);
         expect(keys).toEqual(["m/", "m/a", "m/b"]);
      } finally {
         f.client.destroy();
      }
   });

   it("treats an empty marker as the start", async () => {
      const f = uploadsIn(["m/a"]);
      try {
         await expect(
            listUploadsInFolders(f.scope, SERVER, ["m/"], {
               prefix: "",
               keyMarker: "",
            })
         ).resolves.toMatchObject({ uploads: [{ key: "m/a" }] });
      } finally {
         f.client.destroy();
      }
   });
});

describe("aborting incomplete multipart uploads", () => {
   const uploads = [
      { key: "videos/a.mp4", uploadId: listed("u1", "videos/a.mp4") },
      { key: "videos/b.mp4", uploadId: listed("u2", "videos/b.mp4") },
      { key: "videos/c.mp4", uploadId: listed("u3", "videos/c.mp4") },
   ];

   it("aborts each upload once and never retries", async () => {
      const f = fixture(async (request) => {
         expect(request.method).toBe("DELETE");
         return reply(204);
      });
      try {
         expect(await abortMultipartUploads(f.scope, SERVER, uploads)).toEqual({
            aborted: uploads,
            alreadyGone: [],
            failed: [],
         });
         expect(f.requests).toHaveLength(3);
         expect(
            f.requests.map((request) => request.query.uploadId).sort()
         ).toEqual(["u1", "u2", "u3"]);
      } finally {
         f.client.destroy();
      }
   });

   it("takes ids this instance listed or issued for that key", async () => {
      const f = fixture(async () => reply(204));
      const mixed = [
         uploads[0]!,
         {
            key: "videos/b.mp4",
            uploadId: seal("u2", 1024, undefined, "videos/b.mp4"),
         },
      ];
      try {
         expect(await abortMultipartUploads(f.scope, SERVER, mixed)).toEqual({
            aborted: mixed,
            alreadyGone: [],
            failed: [],
         });
         expect(
            f.requests.map((request) => request.query.uploadId).sort()
         ).toEqual(["u1", "u2"]);
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      ["a bare id from storage", "u1"],
      ["an id listed for another key", listed("u1", "videos/other.mp4")],
      [
         "an id issued for another key",
         seal("u1", 1024, undefined, "videos/other.mp4"),
      ],
      ["a listed id the caller edited", `${listed("u1", "videos/a.mp4")}x`],
      ["an empty listed id", "l1~~"],
   ])("never sends %s to storage", async (_what, uploadId) => {
      const f = fixture(async () => reply(204));
      const upload = { key: "videos/a.mp4", uploadId };
      try {
         expect(await abortMultipartUploads(f.scope, SERVER, [upload])).toEqual(
            {
               aborted: [],
               alreadyGone: [],
               failed: [
                  {
                     ...upload,
                     message: expect.stringContaining(
                        "Refresh it and try again"
                     ),
                  },
               ],
            }
         );
         expect(f.requests).toEqual([]);
      } finally {
         f.client.destroy();
      }
   });

   it("refuses an id listed on another server or bucket", async () => {
      const f = fixture(async () => reply(204));
      const upload = uploads[0]!;
      try {
         for (const [scope, serverId] of [
            [f.scope, "server67890"],
            [{ ...f.scope, bucket: "elsewhere" }, SERVER],
         ] as const) {
            const result = await abortMultipartUploads(scope, serverId, [
               upload,
            ]);
            expect(result.aborted).toEqual([]);
            expect(result.failed).toHaveLength(1);
         }
         expect(f.requests).toEqual([]);
      } finally {
         f.client.destroy();
      }
   });

   it("hands out listed ids that cancel the upload they were listed for", async () => {
      const f = fixture(async (request) =>
         request.method === "GET" ? uploadsPage(["u1"]) : reply(204)
      );
      try {
         const { uploads: found } = await listMultipartUploads(
            f.scope,
            SERVER,
            {
               prefix: "",
            }
         );
         expect(found.map(({ uploadId }) => uploadId)).not.toContain("u1");
         expect(await abortMultipartUploads(f.scope, SERVER, found)).toEqual({
            aborted: found.map(({ key, uploadId }) => ({ key, uploadId })),
            alreadyGone: [],
            failed: [],
         });
         expect(f.requests.at(-1)).toMatchObject({
            method: "DELETE",
            path: "/bucket/videos/u1.mp4",
            query: { uploadId: "u1" },
         });
      } finally {
         f.client.destroy();
      }
   });

   it("keeps an upload whose id is too long to seal on the page, unusable", async () => {
      const long = "x".repeat(1100);
      let listed = 0;
      const f = fixture(async () =>
         uploadsPage(
            ["u1", long, long],
            { key: "videos/z.mp4", uploadId: "z" },
            () => `videos/${listed++}.mp4`
         )
      );
      try {
         const page = await listMultipartUploads(f.scope, SERVER, {
            prefix: "",
         });
         expect(page.uploads).toHaveLength(3);
         expect(page.nextKeyMarker).not.toBeNull();
         const unusable = page.uploads[1]!;
         expect(unusable.uploadId).not.toContain(long);
         expect(page.uploads[2]!.uploadId).not.toBe(unusable.uploadId);
         const requests = f.requests.length;
         expect(
            await abortMultipartUploads(f.scope, SERVER, [unusable])
         ).toMatchObject({
            aborted: [],
            failed: [
               {
                  key: unusable.key,
                  message:
                     "This upload's id is too long to cancel here. Cancel it with your storage provider's tools.",
               },
            ],
         });
         expect(f.requests).toHaveLength(requests);
      } finally {
         f.client.destroy();
      }
   });

   it("reports an upload that is already gone apart from the aborts", async () => {
      const f = fixture(async (request) =>
         request.query.uploadId === "u2"
            ? error(404, "NoSuchUpload")
            : reply(204)
      );
      try {
         expect(await abortMultipartUploads(f.scope, SERVER, uploads)).toEqual({
            aborted: [uploads[0], uploads[2]],
            alreadyGone: [uploads[1]],
            failed: [],
         });
      } finally {
         f.client.destroy();
      }
   });

   it("reports the failures alongside the aborts, one attempt each", async () => {
      const f = fixture(async (request) =>
         request.query.uploadId === "u2"
            ? error(500, "InternalError")
            : reply(204)
      );
      try {
         const result = await abortMultipartUploads(f.scope, SERVER, uploads);
         expect(result.aborted).toEqual([uploads[0], uploads[2]]);
         expect(result.failed).toHaveLength(1);
         expect(result.failed[0]).toMatchObject({
            key: "videos/b.mp4",
            uploadId: uploads[1]!.uploadId,
         });
         expect(result.failed[0]?.message).toBeTruthy();
         expect(
            f.requests.filter((request) => request.query.uploadId === "u2")
         ).toHaveLength(1);
         expect(await f.client.config.maxAttempts()).toBe(3);
      } finally {
         f.client.destroy();
      }
   });
});

const initiated = (uploadId: string) =>
   reply(
      200,
      `<?xml version="1.0" encoding="UTF-8"?><InitiateMultipartUploadResult>` +
         `<Bucket>bucket</Bucket><Key>videos/a.mp4</Key><UploadId>${uploadId}</UploadId>` +
         `</InitiateMultipartUploadResult>`
   );

const partsPage = (
   parts: { partNumber: number; eTag: string; size: number }[],
   nextMarker?: number
) =>
   reply(
      200,
      `<?xml version="1.0" encoding="UTF-8"?><ListPartsResult>` +
         `<Bucket>bucket</Bucket><Key>videos/a.mp4</Key><UploadId>u1</UploadId>` +
         `<IsTruncated>${nextMarker !== undefined}</IsTruncated>` +
         (nextMarker === undefined
            ? ""
            : `<NextPartNumberMarker>${nextMarker}</NextPartNumberMarker>`) +
         parts
            .map(
               ({ partNumber, eTag, size }) =>
                  `<Part><PartNumber>${partNumber}</PartNumber>` +
                  `<ETag>&quot;${eTag}&quot;</ETag><Size>${size}</Size></Part>`
            )
            .join("") +
         `</ListPartsResult>`
   );

const completed = () =>
   reply(
      200,
      `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUploadResult>` +
         `<Bucket>bucket</Bucket><Key>videos/a.mp4</Key><ETag>&quot;final&quot;</ETag>` +
         `</CompleteMultipartUploadResult>`
   );

const head = (headers: Record<string, string>) => empty(200, headers);

const isInitiate = (request: FixtureRequest) =>
   request.method === "POST" && Object.hasOwn(request.query, "uploads");

describe("opening a multipart upload", () => {
   it("carries the content type and never pre-checks a conditional endpoint", async () => {
      const f = fixture(async () => initiated("u1"), AWS_ENDPOINT);
      try {
         expect(
            await createUpload(f.scope, Provider.S3, {
               serverId: SERVER,
               key: "videos/a.mp4",
               contentType: "video/mp4",
               partSize: 5 * 1024 * 1024,
               partCount: 3,
            })
         ).toEqual({
            key: "videos/a.mp4",
            uploadId: seal("u1", 5 * 1024 * 1024),
            partSize: 5 * 1024 * 1024,
            partCount: 3,
         });
         expect(openUploadId(seal("u1", 5 * 1024 * 1024), bound())).toEqual({
            uploadId: "u1",
            partSize: 5 * 1024 * 1024,
         });
         expect(f.requests).toHaveLength(1);
         expect(f.requests[0]?.headers["content-type"]).toBe("video/mp4");
         expect(f.requests[0]?.headers).not.toHaveProperty("if-none-match");
      } finally {
         f.client.destroy();
      }
   });

   it("moves the condition onto initiation for a compatible endpoint", async () => {
      const f = fixture(async (request) =>
         isInitiate(request) ? initiated("u1") : error(404, "NotFound")
      );
      try {
         await createUpload(f.scope, Provider.Other, {
            serverId: SERVER,
            key: "videos/a.mp4",
            contentType: "video/mp4",
            partSize: 1024,
            partCount: 1,
         });
         expect(f.requests[0]?.method).toBe("HEAD");
         expect(f.requests[1]?.headers["if-none-match"]).toBe("*");
      } finally {
         f.client.destroy();
      }
   });

   it("refuses to open an upload over a key that is already taken", async () => {
      const f = fixture(async () => head({ etag: '"existing"' }));
      try {
         await expect(
            createUpload(f.scope, Provider.Other, {
               serverId: SERVER,
               key: "videos/a.mp4",
               contentType: "video/mp4",
               partSize: 1024,
               partCount: 1,
            })
         ).rejects.toMatchObject({ status: 409 });
         expect(f.requests).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("captures the replaced object's settings before any part is sent", async () => {
      const f = fixture(async (request) =>
         isInitiate(request)
            ? initiated("u1")
            : head({
                 etag: '"before"',
                 "content-type": "video/quicktime",
                 "cache-control": "max-age=99",
                 "x-amz-meta-owner": "ana",
              })
      );
      try {
         await createUpload(f.scope, Provider.Other, {
            serverId: SERVER,
            key: "videos/a.mp4",
            contentType: "video/mp4",
            partSize: 1024,
            partCount: 1,
            expectedETag: '"before"',
         });
         const initiate = f.requests.find(isInitiate);
         expect(initiate?.headers["content-type"]).toBe("video/mp4");
         expect(initiate?.headers["cache-control"]).toBe("max-age=99");
         expect(initiate?.headers["x-amz-meta-owner"]).toBe("ana");
         expect(initiate?.headers["if-match"]).toBe('"before"');
      } finally {
         f.client.destroy();
      }
   });

   it("keeps the caller's type when the replaced object carried none", async () => {
      const f = fixture(async (request) =>
         isInitiate(request)
            ? initiated("u1")
            : head({ etag: '"before"', "cache-control": "max-age=99" })
      );
      try {
         await createUpload(f.scope, Provider.Other, {
            serverId: SERVER,
            key: "videos/a.mp4",
            contentType: "video/mp4",
            partSize: 1024,
            partCount: 1,
            expectedETag: '"before"',
         });
         const initiate = f.requests.find(isInitiate);
         expect(initiate?.headers["content-type"]).toBe("video/mp4");
         expect(initiate?.headers["cache-control"]).toBe("max-age=99");
      } finally {
         f.client.destroy();
      }
   });

   it("keeps the replaced object's type when the caller only knows the generic default", async () => {
      const f = fixture(async (request) =>
         isInitiate(request)
            ? initiated("u1")
            : head({
                 etag: '"before"',
                 "content-type": "application/vnd.apache.parquet",
              })
      );
      try {
         await createUpload(f.scope, Provider.Other, {
            serverId: SERVER,
            key: "data/a.parquet",
            contentType: DEFAULT_CONTENT_TYPE,
            partSize: 1024,
            partCount: 1,
            expectedETag: '"before"',
         });
         expect(f.requests.find(isInitiate)?.headers["content-type"]).toBe(
            "application/vnd.apache.parquet"
         );
      } finally {
         f.client.destroy();
      }
   });

   it("keeps the generic default when the replaced object carried no type", async () => {
      const f = fixture(async (request) =>
         isInitiate(request) ? initiated("u1") : head({ etag: '"before"' })
      );
      try {
         await createUpload(f.scope, Provider.Other, {
            serverId: SERVER,
            key: "data/a.parquet",
            contentType: DEFAULT_CONTENT_TYPE,
            partSize: 1024,
            partCount: 1,
            expectedETag: '"before"',
         });
         expect(f.requests.find(isInitiate)?.headers["content-type"]).toBe(
            DEFAULT_CONTENT_TYPE
         );
      } finally {
         f.client.destroy();
      }
   });

   it("carries the generic default onto a new object", async () => {
      const f = fixture(async () => initiated("u1"), AWS_ENDPOINT);
      try {
         await createUpload(f.scope, Provider.S3, {
            serverId: SERVER,
            key: "data/a.parquet",
            contentType: DEFAULT_CONTENT_TYPE,
            partSize: 1024,
            partCount: 1,
         });
         expect(f.requests.find(isInitiate)?.headers["content-type"]).toBe(
            DEFAULT_CONTENT_TYPE
         );
      } finally {
         f.client.destroy();
      }
   });

   it("reports a destination that changed under the replacement as a conflict", async () => {
      const f = fixture(async () => error(412, "PreconditionFailed"));
      try {
         await expect(
            createUpload(f.scope, Provider.S3, {
               serverId: SERVER,
               key: "videos/a.mp4",
               contentType: "video/mp4",
               partSize: 1024,
               partCount: 1,
               expectedETag: '"before"',
            })
         ).rejects.toMatchObject({ status: 409 });
      } finally {
         f.client.destroy();
      }
   });
});

describe("the part size sealed into an upload id", () => {
   it("round trips the original condition and snapshot through JSON and URLs", () => {
      const replacement = {
         expectedETag: '"etag~with\\slashes/and+quotes"',
         settingsDigest: "d".repeat(43),
      };
      const value = seal("id~with/+/separators", 1024, replacement);
      const transported = JSON.parse(JSON.stringify({ uploadId: value })) as {
         uploadId: string;
      };
      const query = new URLSearchParams(transported);
      expect(openUploadId(query.get("uploadId")!, bound())).toEqual({
         uploadId: "id~with/+/separators",
         partSize: 1024,
         ...replacement,
      });
   });

   it.each([0, 1])("refuses a tampered signed snapshot field %i", (index) => {
      const value = seal("u1", 1024, {
         expectedETag: '"before"',
         settingsDigest: "d".repeat(43),
      });
      const fields = value.split("~");
      const snapshot = JSON.parse(
         Buffer.from(fields[2]!, "base64url").toString()
      ) as string[];
      snapshot[index] = index === 0 ? '"after"' : "x".repeat(43);
      fields[2] = Buffer.from(JSON.stringify(snapshot)).toString("base64url");
      expect(() => openUploadId(fields.join("~"), bound())).toThrow(
         /not valid/
      );
   });

   it.each([
      ["another key", bound("videos/other.mp4")],
      ["another bucket", { ...bound(), bucket: "elsewhere" }],
      ["another server", { ...bound(), serverId: "server67890" }],
   ])("refuses a plan issued for %s", (_what, other) => {
      const value = seal("u1", 1024);
      expect(openUploadId(value, bound())).toMatchObject({ uploadId: "u1" });
      expect(() => openUploadId(value, other)).toThrow(/not valid/);
   });

   it("refuses a listed id where a plan is needed", () => {
      const value = listed("u1", KEY);
      expect(() => openUploadId(value, bound())).toThrow(/not valid/);
   });

   it("survives an id storage filled with its own separators", () => {
      const raw = "aWQ~with~tildes.and-dots";
      expect(openUploadId(seal(raw, 8 * 1024 * 1024), bound())).toEqual({
         uploadId: raw,
         partSize: 8 * 1024 * 1024,
      });
   });

   it("refuses an id stripped of its plan", () => {
      expect(() => openUploadId("u1", bound())).toThrow(/not valid/);
      expect(() => openUploadId("", bound())).toThrow(/not valid/);
   });

   it("refuses a plan the caller edited", () => {
      const sealed = seal("u1", 1024);
      expect(() =>
         openUploadId(sealed.replace("~1024~", "~65536~"), bound())
      ).toThrow(/not valid/);
      expect(() => openUploadId(`${sealed}x`, bound())).toThrow(/not valid/);
   });

   it("refuses to seal an id too long to carry its plan", () => {
      expect(sealUploadId("u".repeat(1100), 1024, bound())).toBeUndefined();
   });
});

describe("reading back what storage holds", () => {
   it("follows the part pages and returns them in order", async () => {
      const f = fixture(async (request) =>
         request.query["part-number-marker"] === "2"
            ? partsPage([{ partNumber: 3, eTag: "c", size: 2 }])
            : partsPage(
                 [
                    { partNumber: 2, eTag: "b", size: 5 },
                    { partNumber: 1, eTag: "a", size: 5 },
                 ],
                 2
              )
      );
      try {
         expect(await listUploadedParts(f.scope, "videos/a.mp4", "u1")).toEqual(
            [
               { partNumber: 1, eTag: '"a"', size: 5 },
               { partNumber: 2, eTag: '"b"', size: 5 },
               { partNumber: 3, eTag: '"c"', size: 2 },
            ]
         );
         expect(f.requests).toHaveLength(2);
      } finally {
         f.client.destroy();
      }
   });

   it("stops instead of looping when a truncated page carries no marker", async () => {
      const f = fixture(async () =>
         reply(
            200,
            `<?xml version="1.0" encoding="UTF-8"?><ListPartsResult>` +
               `<IsTruncated>true</IsTruncated></ListPartsResult>`
         )
      );
      try {
         expect(await listUploadedParts(f.scope, "videos/a.mp4", "u1")).toEqual(
            []
         );
         expect(f.requests).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("answers 429 and releases its reservation when the parts exceed read capacity", async () => {
      const maxBytes = 64;
      const budget = installReadBudget(maxBytes, {
         total: 3,
         user: 3,
         server: 3,
      });
      const f = fixture(async () =>
         partsPage([
            { partNumber: 1, eTag: "a", size: 5 },
            { partNumber: 2, eTag: "b", size: 5 },
         ])
      );
      try {
         await expect(
            listUploadedParts(f.scope, "videos/a.mp4", "u1")
         ).rejects.toMatchObject({ status: 429 });
         const probe = budget.acquire({ serverId: "unscoped" });
         try {
            expect(() => probe.retain(maxBytes)).not.toThrow();
         } finally {
            probe.release();
         }
      } finally {
         vi.mocked(readBudget.acquire).mockRestore();
         f.client.destroy();
      }
   });
});

describe("committing a multipart upload", () => {
   const stored = [
      { partNumber: 1, eTag: "a", size: 5 },
      { partNumber: 2, eTag: "b", size: 2 },
   ];
   const declared = [
      { partNumber: 1, eTag: '"a"' },
      { partNumber: 2, eTag: '"b"' },
   ];

   it.each([false, true])(
      "rechecks a fallback destination before completion (occupied: %s)",
      async (occupied) => {
         let heads = 0;
         const f = fixture(async (request) => {
            if (request.method === "HEAD")
               return ++heads === 2 && occupied
                  ? head({ etag: '"other"' })
                  : reply(404);
            if (isInitiate(request)) return initiated("u1");
            if (request.method === "DELETE") return reply(204);
            return request.method === "POST" ? completed() : partsPage(stored);
         });
         try {
            const upload = await createUpload(f.scope, Provider.Other, {
               serverId: SERVER,
               key: "videos/a.mp4",
               contentType: "video/mp4",
               partSize: 1024,
               partCount: 2,
            });
            const pending = completeUpload(f.scope, {
               serverId: SERVER,
               key: upload.key,
               uploadId: upload.uploadId,
               parts: declared,
               maxBytes: 1024,
            });
            if (occupied)
               await expect(pending).rejects.toMatchObject({ status: 409 });
            else
               await expect(pending).resolves.toMatchObject({
                  eTag: '"final"',
               });
            expect(f.requests.map((request) => request.method)).toEqual([
               "HEAD",
               "POST",
               "GET",
               "HEAD",
               occupied ? "DELETE" : "POST",
            ]);
            if (!occupied)
               expect(f.requests.at(-1)?.headers["if-none-match"]).toBe("*");
         } finally {
            f.client.destroy();
         }
      }
   );

   it("refuses to publish a plan issued for another key, and leaves that upload alone", async () => {
      const f = fixture(async () => reply(204), AWS_ENDPOINT);
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024, undefined, "videos/other.mp4"),
               parts: declared,
               maxBytes: 1024,
            })
         ).rejects.toMatchObject({ status: 400 });
         expect(f.requests).toEqual([]);
      } finally {
         f.client.destroy();
      }
   });

   it.each([
      [undefined, '"changed"'],
      ['"before"', undefined],
      ['"before"', '"changed"'],
   ])(
      "refuses to change the original condition from %s to %s",
      async (original, expectedETag) => {
         const f = fixture(async () => reply(204), AWS_ENDPOINT);
         try {
            await expect(
               completeUpload(f.scope, {
                  serverId: SERVER,
                  key: "videos/a.mp4",
                  uploadId: seal(
                     "u1",
                     1024,
                     original === undefined
                        ? undefined
                        : {
                             expectedETag: original,
                             settingsDigest: "d".repeat(43),
                          }
                  ),
                  parts: declared,
                  expectedETag,
                  maxBytes: 1024,
               })
            ).rejects.toMatchObject({ status: 409 });
            expect(f.requests.map((request) => request.method)).toEqual([
               "DELETE",
            ]);
         } finally {
            f.client.destroy();
         }
      }
   );

   it.each([
      ["metadata", { "x-amz-meta-owner": "bea" }],
      ["content type", { "content-type": "application/json" }],
      ["cache policy", { "cache-control": "max-age=100" }],
      ["disposition", { "content-disposition": "attachment" }],
      ["language", { "content-language": "fr" }],
      ["expiry", { expires: "Sun, 20 Sep 2026 01:00:00 GMT" }],
      ["storage class", { "x-amz-storage-class": "STANDARD_IA" }],
      ["encryption", { "x-amz-server-side-encryption": "AES256" }],
      ["KMS key", { "x-amz-server-side-encryption-aws-kms-key-id": "key2" }],
      [
         "bucket key",
         { "x-amz-server-side-encryption-bucket-key-enabled": "true" },
      ],
      ["version", { "x-amz-version-id": "version2" }],
   ])(
      "aborts a replacement when its %s changes without an ETag change",
      async (_name, changes) => {
         let initiatedUpload = false;
         const f = fixture(async (request) => {
            if (isInitiate(request)) {
               initiatedUpload = true;
               return initiated("u1");
            }
            if (request.method === "DELETE") return reply(204);
            if (request.method === "HEAD")
               return head({
                  etag: '"before"',
                  "content-type": "video/mp4",
                  "x-amz-meta-owner": "ana",
                  ...(initiatedUpload ? changes : {}),
               });
            if (request.method === "POST") return completed();
            return partsPage(stored);
         }, AWS_ENDPOINT);
         try {
            const upload = await createUpload(f.scope, Provider.R2, {
               serverId: SERVER,
               key: "videos/a.mp4",
               contentType: "video/mp4",
               partSize: 1024,
               partCount: 2,
               expectedETag: '"before"',
            });
            await expect(
               completeUpload(f.scope, {
                  serverId: SERVER,
                  key: upload.key,
                  uploadId: upload.uploadId,
                  parts: declared,
                  expectedETag: '"before"',
                  maxBytes: 1024,
               })
            ).rejects.toMatchObject({
               status: 409,
               message: expect.stringMatching(/settings changed/),
            });
            expect(f.requests.at(-1)?.method).toBe("DELETE");
            expect(
               f.requests.filter(
                  (request) => request.method === "POST" && !isInitiate(request)
               )
            ).toHaveLength(0);
         } finally {
            f.client.destroy();
         }
      }
   );

   it("completes unchanged settings when HEAD returns metadata in a different order", async () => {
      let heads = 0;
      const f = fixture(async (request) => {
         if (request.method === "HEAD")
            return head({
               etag: '"before"',
               expires: "Sun, 20 Sep 2026 01:00:00 GMT",
               ...(heads++ === 0
                  ? { "x-amz-meta-a": "one", "x-amz-meta-b": "two" }
                  : { "x-amz-meta-b": "two", "x-amz-meta-a": "one" }),
            });
         if (isInitiate(request)) return initiated("u1");
         return request.method === "POST" ? completed() : partsPage(stored);
      }, AWS_ENDPOINT);
      try {
         const upload = await createUpload(f.scope, Provider.R2, {
            serverId: SERVER,
            key: "videos/a.mp4",
            contentType: "video/mp4",
            partSize: 1024,
            partCount: 2,
            expectedETag: '"before"',
         });
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: upload.key,
               uploadId: upload.uploadId,
               parts: declared,
               expectedETag: '"before"',
               maxBytes: 1024,
            })
         ).resolves.toMatchObject({ eTag: '"final"' });
         expect(heads).toBe(2);
         expect(f.requests.at(-1)?.headers["if-match"]).toBe('"before"');
      } finally {
         f.client.destroy();
      }
   });

   it("commits what storage holds and measures the object from it", async () => {
      const f = fixture(
         async (request) =>
            request.method === "POST" ? completed() : partsPage(stored),
         AWS_ENDPOINT
      );
      try {
         expect(
            await completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: declared,
               maxBytes: 1024,
            })
         ).toEqual({ key: "videos/a.mp4", size: 7, eTag: '"final"' });
         expect(f.requests[1]?.headers["if-none-match"]).toBe("*");
      } finally {
         f.client.destroy();
      }
   });

   it("publishes under a deadline sized from the stored parts, not the listing deadline", async () => {
      const listing = new AbortController();
      const commit = new AbortController();
      const commitSignal = vi.fn((size: number) => {
         expect(size).toBe(7);
         return commit.signal;
      });
      const f = fixture(async (request) => {
         if (request.method !== "POST") return partsPage(stored);
         listing.abort();
         await new Promise((resolve) => setImmediate(resolve));
         return completed();
      }, AWS_ENDPOINT);
      try {
         expect(
            await completeUpload(
               { ...f.scope, signal: listing.signal },
               {
                  serverId: SERVER,
                  key: "videos/a.mp4",
                  uploadId: seal("u1", 1024),
                  parts: declared,
                  maxBytes: 1024,
                  commitSignal,
               }
            )
         ).toMatchObject({ size: 7, eTag: '"final"' });
         expect(commitSignal).toHaveBeenCalledOnce();
      } finally {
         f.client.destroy();
      }
   });

   it("stops a publish whose own deadline passes", async () => {
      const commit = new AbortController();
      const f = fixture(async (request) => {
         if (request.method !== "POST") return partsPage(stored);
         commit.abort();
         await new Promise((resolve) => setImmediate(resolve));
         return completed();
      }, AWS_ENDPOINT);
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: declared,
               maxBytes: 1024,
               commitSignal: () => commit.signal,
            })
         ).rejects.toMatchObject({ status: 502 });
         expect(
            f.requests.filter((request) => request.method === "DELETE")
         ).toEqual([]);
      } finally {
         f.client.destroy();
      }
   });

   it("refuses when the browser's parts disagree with storage", async () => {
      const f = fixture(async () => partsPage(stored), AWS_ENDPOINT);
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: [
                  { partNumber: 1, eTag: '"a"' },
                  { partNumber: 2, eTag: '"somebody-elses"' },
               ],
               maxBytes: 1024,
            })
         ).rejects.toMatchObject({ status: 409 });
         expect(f.requests).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("refuses an object larger than the instance allows and discards the parts", async () => {
      const f = fixture(
         async (request) =>
            request.method === "DELETE" ? reply(204) : partsPage(stored),
         AWS_ENDPOINT
      );
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: declared,
               maxBytes: 6,
            })
         ).rejects.toMatchObject({ status: 413 });
         expect(f.requests.at(-1)?.method).toBe("DELETE");
      } finally {
         f.client.destroy();
      }
   });

   it("discards the upload when the destination refuses it", async () => {
      const f = fixture(async (request) => {
         if (request.method === "DELETE") return reply(204);
         if (request.method === "POST") return error(412, "PreconditionFailed");
         return partsPage(stored);
      }, AWS_ENDPOINT);
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: declared,
               maxBytes: 1024,
            })
         ).rejects.toMatchObject({ status: 409 });
         expect(f.requests.at(-1)?.method).toBe("DELETE");
      } finally {
         f.client.destroy();
      }
   });

   it("keeps the parts when the commit could still succeed on a retry", async () => {
      const f = fixture(async (request) => {
         if (request.method === "POST") return error(500, "InternalError");
         return partsPage(stored);
      }, AWS_ENDPOINT);
      try {
         await expect(
            completeUpload(f.scope, {
               serverId: SERVER,
               key: "videos/a.mp4",
               uploadId: seal("u1", 1024),
               parts: declared,
               maxBytes: 1024,
            })
         ).rejects.toMatchObject({ status: 502 });
         expect(
            f.requests.filter((request) => request.method === "DELETE")
         ).toHaveLength(0);
      } finally {
         f.client.destroy();
      }
   });
});

describe("streaming one part", () => {
   const PART_BYTES = 1024 * 1024;
   const partReply = {
      response: {
         statusCode: 200,
         headers: { etag: '"p1"' },
         body: Readable.from([]),
      },
   };

   it("declares the length it was given and returns the stored part", async () => {
      const f = fixture(async () => partReply, AWS_ENDPOINT);
      try {
         expect(
            await streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 4,
               body: Readable.from(["hello"]),
               contentLength: 5,
               abortController: new AbortController(),
               idleTimeoutMs: 1000,
            })
         ).toEqual({ partNumber: 4, eTag: '"p1"', size: 5 });
         expect(f.requests[0]?.query).toMatchObject({
            partNumber: "4",
            uploadId: "u1",
         });
         expect(f.requests[0]?.headers["x-amz-decoded-content-length"]).toBe(
            "5"
         );
      } finally {
         f.client.destroy();
      }
   });

   it("never retries a body it has already read", async () => {
      const f = fixture(async () => error(500, "InternalError"), AWS_ENDPOINT);
      try {
         await expect(
            streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body: Readable.from(["hello"]),
               contentLength: 5,
               abortController: new AbortController(),
               idleTimeoutMs: 1000,
            })
         ).rejects.toMatchObject({ status: 502 });
         expect(f.requests).toHaveLength(1);
      } finally {
         f.client.destroy();
      }
   });

   it("gives up on a body that stops arriving", async () => {
      const stalled = new PassThrough();
      stalled.write("x");
      const f = fixture(
         async () => new Promise(() => undefined) as never,
         AWS_ENDPOINT
      );
      try {
         await expect(
            streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body: stalled,
               contentLength: 5,
               abortController: new AbortController(),
               idleTimeoutMs: 20,
            })
         ).rejects.toBeInstanceOf(UploadIdleError);
      } finally {
         stalled.destroy();
         f.client.destroy();
      }
   });

   it("blames storage, not the browser, when storage stops reading the part", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      const { client } = s3Fixture(
         (_request, { abortSignal }) =>
            new Promise((_resolve, reject) =>
               abortSignal?.addEventListener("abort", () =>
                  reject(new Error("FixtureRequest aborted"))
               )
            ),
         { requestChecksumCalculation: "WHEN_REQUIRED" }
      );
      try {
         const pending = streamPart(
            { client, bucket: "bucket" },
            {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body,
               contentLength: PART_BYTES,
               abortController: new AbortController(),
               idleTimeoutMs: 40,
            }
         );
         const settled = vi.fn();
         pending.catch(settled);
         body.write(Buffer.alloc(PART_BYTES, 1));
         await vi.advanceTimersByTimeAsync(1);
         expect(body.readableFlowing).toBe(false);
         await vi.advanceTimersByTimeAsync(stallMsFor(40, PART_BYTES) - 2);
         expect(settled).not.toHaveBeenCalled();
         await vi.advanceTimersByTimeAsync(2);
         await expect(pending).rejects.toBeInstanceOf(StorageStalledError);
      } finally {
         body.destroy();
         client.destroy();
         vi.useRealTimers();
      }
   });

   const paced = (
      everyMs: number,
      chunks: number,
      bytes: number
   ): PassThrough => {
      const body = new PassThrough();
      let sent = 0;
      const timer = setInterval(() => {
         if (sent++ >= chunks) {
            clearInterval(timer);
            body.end();
            return;
         }
         body.write(Buffer.alloc(bytes, 1));
      }, everyMs);
      body.on("close", () => clearInterval(timer));
      return body;
   };

   it("gives up on a part that trickles under the floor", async () => {
      const body = paced(10, 40, 1);
      const f = fixture(
         async () => new Promise(() => undefined) as never,
         AWS_ENDPOINT
      );
      try {
         await expect(
            streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body,
               contentLength: 40,
               abortController: new AbortController(),
               idleTimeoutMs: 40,
            })
         ).rejects.toBeInstanceOf(UploadIdleError);
      } finally {
         body.destroy();
         f.client.destroy();
      }
   });

   it("leaves a part arriving above the floor alone", async () => {
      const body = paced(15, 8, 1024);
      const f = fixture(async () => partReply, AWS_ENDPOINT);
      try {
         expect(
            await streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body,
               contentLength: 8 * 1024,
               abortController: new AbortController(),
               idleTimeoutMs: 40,
            })
         ).toMatchObject({ eTag: '"p1"' });
      } finally {
         body.destroy();
         f.client.destroy();
      }
   });

   it("lets a short part end inside a window it never fills", async () => {
      const body = new PassThrough();
      const timer = setTimeout(() => body.end("hi"), 20);
      const f = fixture(async () => partReply, AWS_ENDPOINT);
      try {
         expect(
            await streamPart(f.scope, {
               key: "videos/a.mp4",
               uploadId: "u1",
               partNumber: 1,
               body,
               contentLength: 2,
               abortController: new AbortController(),
               idleTimeoutMs: 40,
            })
         ).toMatchObject({ eTag: '"p1"' });
      } finally {
         clearTimeout(timer);
         body.destroy();
         f.client.destroy();
      }
   });
});

describe("explicit multipart cancellation", () => {
   it.each([
      [403, "AccessDenied"],
      [500, "InternalError"],
   ])("surfaces provider failure %s", async (status, code) => {
      const f = fixture(async () => error(Number(status), String(code)));
      try {
         await expect(
            abortMultipartUpload(f.scope, "a", "upload")
         ).rejects.toHaveProperty("status");
      } finally {
         f.client.destroy();
      }
   });

   it("refuses a user's ninth concurrent cancel before storage while cleanup still runs", async () => {
      const gate = Promise.withResolvers<void>();
      const f = fixture(async () => {
         await gate.promise;
         return empty(204);
      });
      const client = withRequestBudget(f.client, "cancel-pool");
      const scope = { ...f.scope, client };
      try {
         const pending = Array.from({ length: 8 }, (_, index) =>
            withReadUser("alice", () =>
               abortMultipartUpload(scope, `a${index}`, "upload")
            )
         );
         await vi.waitFor(() => expect(f.requests).toHaveLength(8));
         await expect(
            withReadUser("alice", () =>
               abortMultipartUpload(scope, "a8", "upload")
            )
         ).rejects.toMatchObject({ status: 429 });
         const cleanup = withReadUser("alice", () =>
            abortForCleanup(scope, "b", "upload")
         );
         await vi.waitFor(() => expect(f.requests).toHaveLength(9));
         gate.resolve();
         expect(await Promise.all(pending)).toEqual(Array(8).fill(true));
         await cleanup;
      } finally {
         resetRequestBudgets();
         f.client.destroy();
      }
   });

   it("treats NoSuchUpload as success without an abort", async () => {
      const f = fixture(async () => error(404, "NoSuchUpload"));
      try {
         await expect(
            abortMultipartUpload(f.scope, "a", "upload")
         ).resolves.toBe(false);
      } finally {
         f.client.destroy();
      }
   });

   it("leaves cleanup failures secondary to the operation failure", async () => {
      const f = fixture(async () => error(403, "AccessDenied"));
      try {
         await expect(
            abortForCleanup(f.scope, "a", "upload")
         ).resolves.toBeUndefined();
      } finally {
         f.client.destroy();
      }
   });

   it("times out an explicit abort without reporting success", async () => {
      vi.useFakeTimers();
      const f = fixture(async () => new Promise(() => undefined));
      try {
         const rejected = expect(
            abortMultipartUpload(f.scope, "a", "upload")
         ).rejects.toMatchObject({ status: 502 });
         await vi.advanceTimersByTimeAsync(CLEANUP_TIMEOUT_MS);
         await rejected;
      } finally {
         vi.useRealTimers();
         f.client.destroy();
      }
   });

   it("bounds oversized upload ID cleanup and preserves the original error", async () => {
      vi.useFakeTimers();
      const f = fixture(async (request) => {
         if (request.method === "DELETE") return new Promise(() => undefined);
         return reply(
            200,
            `<InitiateMultipartUploadResult><UploadId>${"x".repeat(1024)}</UploadId></InitiateMultipartUploadResult>`
         );
      });
      try {
         const rejected = expect(
            createUpload(f.scope, Provider.S3, {
               serverId: SERVER,
               key: "a",
               contentType: "text/plain",
               partSize: 10,
               partCount: 1,
            })
         ).rejects.toMatchObject({
            status: 502,
            message: "Storage issued an upload id this instance cannot carry.",
         });
         await vi.advanceTimersByTimeAsync(CLEANUP_TIMEOUT_MS);
         await rejected;
         expect(f.requests.some((request) => request.method === "DELETE")).toBe(
            true
         );
      } finally {
         vi.useRealTimers();
         f.client.destroy();
      }
   });
});
