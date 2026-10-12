import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
   class FakeApiError extends Error {
      constructor(
         public readonly status: number,
         message: string,
         public readonly code?: string
      ) {
         super(message);
      }
   }
   return {
      FakeApiError,
      post: vi.fn(),
      get: vi.fn(),
      exists: vi.fn(),
      inFlight: 0,
      peak: 0,
   };
});
const FakeApiError = h.FakeApiError;

vi.mock("@/lib/api", () => {
   const Error_ = h.FakeApiError;
   return {
      ApiError: Error_,
      api: { post: h.post, get: h.get },
      cancelledError: () => new Error_(0, "Request cancelled"),
      errorMessage: (error: unknown) =>
         error instanceof Error ? error.message : "failed",
      isAborted: (error: unknown) =>
         error instanceof Error && error.message === "Request cancelled",
      objectsPath: (serverId: string, bucketName: string) =>
         `/servers/${serverId}/buckets/${bucketName}/objects`,
      qs: (params: Record<string, string | undefined>) =>
         params.continuationToken ? `?token=${params.continuationToken}` : "",
      serverPath: (serverId: string) => `/servers/${serverId}`,
   };
});
vi.mock("@/lib/utils/s3/upload-preflight", () => ({
   checkUploadConflicts: h.exists,
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
   useMutation: vi.fn(),
   useQueryClient: vi.fn(),
}));

const { transferObjects, createTransferOperation } = await import(
   "./useTransferObjects"
);

const input = (overrides: Record<string, unknown> = {}) => ({
   userId: "user-1",
   serverId: "source-server",
   bucketName: "photos",
   destination: {
      serverId: "other-server",
      bucketName: "archive",
      prefix: "2026/",
   },
   overwrite: false,
   source: {
      prefix: "raw/",
      objects: [
         { key: "raw/a.png", expectedETag: '"a"', size: 10 },
         { key: "raw/b.png", expectedETag: '"b"', size: 20 },
         { key: "raw/c.png", expectedETag: '"c"', size: 30 },
      ],
   },
   ...overrides,
});

beforeEach(() => {
   vi.resetAllMocks();
   h.inFlight = 0;
   h.peak = 0;
   h.exists.mockResolvedValue({ existing: [], eTags: {} });
   h.post.mockImplementation(async () => {
      h.peak = Math.max(h.peak, ++h.inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      h.inFlight--;
      return { key: "", size: 7, eTag: '"new"' };
   });
});

describe("copying selected objects to another bucket", () => {
   it("copies every object under the destination prefix", async () => {
      const summary = await transferObjects(input());
      expect(summary).toMatchObject({
         transferred: 3,
         skipped: 0,
         bytes: 21,
         failed: [],
         remaining: false,
      });
      expect(h.post).toHaveBeenCalledWith(
         "/servers/source-server/transfers",
         {
            expectedUserId: "user-1",
            source: {
               bucketName: "photos",
               objectKey: "raw/a.png",
               expectedETag: '"a"',
            },
            destination: {
               serverId: "other-server",
               bucketName: "archive",
               objectKey: "2026/a.png",
            },
            overwrite: false,
         },
         expect.anything()
      );
   });

   it("keeps at most two copies in flight", async () => {
      await transferObjects(input());
      expect(h.peak).toBe(2);
   });

   it("leaves objects already at the destination alone", async () => {
      h.exists.mockResolvedValue({ existing: ["2026/b.png"], eTags: {} });
      const summary = await transferObjects(input());
      expect(summary).toMatchObject({ transferred: 2, skipped: 1 });
      expect(h.post).toHaveBeenCalledTimes(2);
   });

   it("does not check the destination when replacing", async () => {
      const summary = await transferObjects(input({ overwrite: true }));
      expect(h.exists).not.toHaveBeenCalled();
      expect(summary.transferred).toBe(3);
      expect(h.post.mock.calls[0]?.[1]).toMatchObject({ overwrite: true });
   });

   it("reports a failed object and whether retrying makes sense", async () => {
      h.post
         .mockRejectedValueOnce(new FakeApiError(409, "Already exists."))
         .mockRejectedValueOnce(
            new FakeApiError(429, "Storage is busy.", "TRANSFER_NOT_STARTED")
         )
         .mockResolvedValue({ key: "", size: 1, eTag: null });
      const summary = await transferObjects(input());
      expect(summary.transferred).toBe(1);
      expect(summary.failed).toEqual([
         expect.objectContaining({ retryable: false }),
         expect.objectContaining({ retryable: true }),
      ]);
      expect(summary.remaining).toBe(true);
   });

   it("closes the message before asking for a review", async () => {
      h.post
         .mockRejectedValueOnce(new FakeApiError(409, "Already exists"))
         .mockResolvedValue({ key: "", size: 1, eTag: null });
      const summary = await transferObjects(input());
      expect(summary.failed[0]?.message).toBe(
         "Already exists. Review this object at the destination before copying it again."
      );
   });

   const LIMITED = "Your access to this bucket is limited to landing/";
   const refusal = () => new FakeApiError(403, LIMITED, "FOLDER_ACCESS");

   it("reports a folder refusal once, not per object", async () => {
      h.post.mockRejectedValue(refusal());
      const summary = await transferObjects(input());
      expect(summary.failed).toEqual([]);
      expect(summary.listingError).toBe(
         `Copying from photos to archive was refused. ${LIMITED}. The copy is incomplete.`
      );
      expect(summary.remaining).toBe(true);
      expect(summary.listingError).not.toContain("Review");
      expect(h.post.mock.calls.length).toBeLessThan(3);
   });

   it("says the destination refused when only it was asked", async () => {
      h.exists.mockRejectedValue(refusal());
      const summary = await transferObjects(input());
      expect(summary.listingError).toBe(
         `Couldn't check archive. ${LIMITED}. The copy is incomplete.`
      );
   });

   it("says the source refused when listing it failed", async () => {
      h.get.mockRejectedValue(refusal());
      const summary = await transferObjects(
         input({ source: { folderKey: "raw/" } })
      );
      expect(summary.listingError).toBe(
         `Couldn't read photos. ${LIMITED}. The copy is incomplete.`
      );
   });

   it("can carry on with the same objects once access is sorted out", async () => {
      h.post.mockRejectedValueOnce(refusal()).mockRejectedValueOnce(refusal());
      const operation = createTransferOperation(input());
      await transferObjects({ ...input(), operation });
      h.post.mockResolvedValue({ key: "", size: 1, eTag: null });
      const summary = await transferObjects({ ...input(), operation });
      expect(summary.transferred).toBe(3);
      expect(summary.listingError).toBeNull();
      expect(summary.remaining).toBe(false);
   });

   it("stops with an explanation when the destination cannot be checked", async () => {
      h.exists.mockRejectedValue(new FakeApiError(403, "Not allowed."));
      const summary = await transferObjects(input());
      expect(h.post).not.toHaveBeenCalled();
      expect(summary.listingError).toContain("Not allowed.");
      expect(summary.remaining).toBe(true);
   });
});

describe("copying a folder to another bucket", () => {
   const folder = { source: { folderKey: "raw/" } };

   it("relists the folder and rebuilds each key under the new prefix", async () => {
      h.get
         .mockResolvedValueOnce({
            objects: [{ key: "raw/one.txt", expectedETag: '"1"' }],
            nextToken: "page-2",
         })
         .mockResolvedValueOnce({
            objects: [{ key: "raw/deep/two.txt", expectedETag: null }],
            nextToken: null,
         });
      const summary = await transferObjects(input(folder));
      expect(summary).toMatchObject({ transferred: 2, remaining: false });
      expect(
         h.post.mock.calls.map(
            (call) =>
               (call[1] as { destination: { objectKey: string } }).destination
                  .objectKey
         )
      ).toEqual(["2026/one.txt", "2026/deep/two.txt"]);
   });

   it("stops at the first failing page so a rerun resumes there", async () => {
      h.get
         .mockResolvedValueOnce({
            objects: [{ key: "raw/one.txt", expectedETag: '"1"' }],
            nextToken: "page-2",
         })
         .mockResolvedValueOnce({
            objects: [{ key: "raw/two.txt", expectedETag: '"2"' }],
            nextToken: null,
         });
      h.post.mockRejectedValueOnce(new FakeApiError(500, "Storage failed."));
      const summary = await transferObjects(input(folder));
      expect(h.get).toHaveBeenCalledTimes(1);
      expect(summary).toMatchObject({ transferred: 0, remaining: true });
   });

   it("refuses a listing page that leaves the folder", async () => {
      h.get.mockResolvedValue({
         objects: [{ key: "other/one.txt", expectedETag: '"1"' }],
         nextToken: null,
      });
      const summary = await transferObjects(input(folder));
      expect(h.post).not.toHaveBeenCalled();
      expect(summary.listingError).toContain("outside this folder");
      expect(summary.remaining).toBe(true);
   });

   it("refuses a repeated continuation token", async () => {
      h.get.mockResolvedValue({ objects: [], nextToken: "loop" });
      const summary = await transferObjects(input(folder));
      expect(summary.listingError).toContain("repeated");
   });
});

describe("transferring exact slash-ending objects", () => {
   it.each([0, 12, null])(
      "copies size %s through the guarded transfer endpoint",
      async (size) => {
         h.get.mockResolvedValue({
            objects: [{ key: "raw/data/", expectedETag: '"reviewed"', size }],
            nextToken: null,
         });
         const summary = await transferObjects(
            input({ source: { folderKey: "raw/" } })
         );
         expect(summary).toMatchObject({
            transferred: 1,
            skipped: 0,
            failed: [],
         });
         expect(h.post).toHaveBeenCalledExactlyOnceWith(
            "/servers/source-server/transfers",
            expect.objectContaining({
               source: {
                  bucketName: "photos",
                  objectKey: "raw/data/",
                  expectedETag: '"reviewed"',
               },
               destination: {
                  serverId: "other-server",
                  bucketName: "archive",
                  objectKey: "2026/data/",
               },
            }),
            expect.anything()
         );
      }
   );

   it("counts an existing marker as skipped without claiming the source was copied", async () => {
      h.get.mockResolvedValue({
         objects: [{ key: "raw/data/", expectedETag: '"reviewed"', size: 12 }],
         nextToken: null,
      });
      h.exists.mockResolvedValue({ existing: ["2026/data/"], eTags: {} });
      const summary = await transferObjects(
         input({ source: { folderKey: "raw/" } })
      );
      expect(summary).toMatchObject({ transferred: 0, skipped: 1, failed: [] });
      expect(h.post).not.toHaveBeenCalled();
   });

   it("reports a changed source as a failed transfer", async () => {
      h.get.mockResolvedValue({
         objects: [{ key: "raw/data/", expectedETag: '"reviewed"', size: 0 }],
         nextToken: null,
      });
      h.post.mockRejectedValue(new FakeApiError(409, "The file changed."));
      const summary = await transferObjects(
         input({ source: { folderKey: "raw/" } })
      );
      expect(summary).toMatchObject({
         transferred: 0,
         remaining: false,
         failed: [{ key: "raw/data/", retryable: false }],
      });
   });
});

describe("transfer cancellation", () => {
   it("rejects before any request when already cancelled", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
         transferObjects(input({ signal: controller.signal }))
      ).rejects.toThrow("Request cancelled");
      expect(h.exists).not.toHaveBeenCalled();
      expect(h.post).not.toHaveBeenCalled();
   });

   it("settles in-flight copies and rejects instead of reporting an incomplete worker array as success", async () => {
      const controller = new AbortController();
      h.post.mockImplementation(async () => {
         await new Promise((resolve) => setTimeout(resolve, 0));
         controller.abort();
         return { key: "", size: 1, eTag: '"copied"' };
      });
      await expect(
         transferObjects(input({ signal: controller.signal }))
      ).rejects.toThrow("Request cancelled");
      expect(h.post).toHaveBeenCalledTimes(2);
   });
});

describe("reviewed transfer continuations", () => {
   it("never replays a successful overwrite when retrying an explicitly refused request", async () => {
      const request = input({ overwrite: true });
      const operation = createTransferOperation(request);
      const destination = new Map<string, string>();
      let refused = true;
      h.post.mockImplementation(async (_path, body) => {
         const key = body.source.objectKey;
         if (key === "raw/b.png" && refused)
            throw new FakeApiError(429, "Busy", "TRANSFER_NOT_STARTED");
         destination.set(body.destination.objectKey, body.source.expectedETag);
         return { size: 1 };
      });
      const first = await transferObjects({ ...request, operation });
      expect(first).toMatchObject({ transferred: 2, remaining: true });
      destination.set("2026/a.png", "newer edit");
      refused = false;
      h.post.mockClear();
      const resumed = await transferObjects({ ...request, operation });
      expect(h.post).toHaveBeenCalledOnce();
      expect(h.post.mock.calls[0]?.[1].source).toMatchObject({
         objectKey: "raw/b.png",
         expectedETag: '"b"',
      });
      expect(destination.get("2026/a.png")).toBe("newer edit");
      expect(resumed).toMatchObject({
         transferred: 3,
         remaining: false,
         failed: [],
      });
   });

   it("retries only safe failures and retains unknown and non-retryable outcomes", async () => {
      const request = input({ overwrite: true });
      const operation = createTransferOperation(request);
      h.post
         .mockRejectedValueOnce(new FakeApiError(503, "Response lost"))
         .mockRejectedValueOnce(new FakeApiError(409, "Source changed"))
         .mockRejectedValueOnce(
            new FakeApiError(429, "Busy", "TRANSFER_NOT_STARTED")
         );
      const first = await transferObjects({ ...request, operation });
      expect(first.failed.map(({ outcome }) => outcome)).toEqual([
         "unknown",
         "failed",
         "failed",
      ]);
      h.post.mockReset().mockResolvedValue({ size: 1 });
      const resumed = await transferObjects({ ...request, operation });
      expect(h.post).toHaveBeenCalledOnce();
      expect(h.post.mock.calls[0]?.[1].source.objectKey).toBe("raw/c.png");
      expect(resumed).toMatchObject({ transferred: 1, remaining: false });
      expect(resumed.failed).toHaveLength(2);
   });

   it("keeps an unreadable 2xx reply as an unknown outcome, since the copy may have landed", async () => {
      const request = input({ overwrite: true });
      const operation = createTransferOperation(request);
      h.post
         .mockRejectedValueOnce(
            new FakeApiError(200, "Unexpected response", "BAD_RESPONSE")
         )
         .mockResolvedValue({ size: 1 });
      const result = await transferObjects({ ...request, operation });
      expect(result.failed).toMatchObject([
         { key: "raw/a.png", outcome: "unknown" },
      ]);
   });

   it("continues a cancelled page without replaying successes or interrupted writes", async () => {
      const request = input({ overwrite: true });
      const operation = createTransferOperation(request);
      const controller = new AbortController();
      h.post.mockImplementation(async (_path, body) => {
         if (body.source.objectKey === "raw/a.png") return { size: 1 };
         controller.abort();
         throw new FakeApiError(0, "Request cancelled");
      });
      await expect(
         transferObjects({ ...request, operation, signal: controller.signal })
      ).rejects.toThrow("Request cancelled");
      expect(operation.summary).toMatchObject({
         transferred: 1,
         remaining: true,
         failed: [{ key: "raw/b.png", outcome: "unknown" }],
      });
      h.post.mockReset().mockResolvedValue({ size: 1 });
      const resumed = await transferObjects({ ...request, operation });
      expect(h.post).toHaveBeenCalledOnce();
      expect(h.post.mock.calls[0]?.[1].source.objectKey).toBe("raw/c.png");
      expect(resumed).toMatchObject({ transferred: 2, remaining: false });
   });

   it("retains a folder page's reviewed ETags and resumes its cursor after a retry", async () => {
      const request = input({ source: { folderKey: "raw/" }, overwrite: true });
      const operation = createTransferOperation(request);
      h.get
         .mockResolvedValueOnce({
            objects: [
               { key: "raw/a.png", expectedETag: '"original-a"' },
               { key: "raw/b.png", expectedETag: '"original-b"' },
            ],
            nextToken: "page-2",
         })
         .mockResolvedValueOnce({
            objects: [{ key: "raw/c.png", expectedETag: '"original-c"' }],
            nextToken: null,
         });
      h.post
         .mockResolvedValueOnce({ size: 1 })
         .mockRejectedValueOnce(
            new FakeApiError(429, "Busy", "TRANSFER_NOT_STARTED")
         );
      await transferObjects({ ...request, operation });
      h.post.mockReset().mockResolvedValue({ size: 1 });
      const resumed = await transferObjects({ ...request, operation });
      expect(h.get).toHaveBeenCalledTimes(2);
      expect(h.get.mock.calls[1]?.[0]).toContain("token=page-2");
      expect(h.post.mock.calls.map(([, body]) => body.source)).toEqual([
         {
            bucketName: "photos",
            objectKey: "raw/b.png",
            expectedETag: '"original-b"',
         },
         {
            bucketName: "photos",
            objectKey: "raw/c.png",
            expectedETag: '"original-c"',
         },
      ]);
      expect(resumed).toMatchObject({
         transferred: 3,
         failed: [],
         remaining: false,
      });
   });

   it.each(["raw/", "raw/deep/", "raw/deep/deeper/", ""])(
      "rejects overlapping same-bucket prefix %s before listing a 1,001-object folder",
      async (prefix) => {
         h.get.mockResolvedValue({
            objects: Array.from({ length: 1000 }, (_, n) => ({
               key: `raw/deep/deep/item-${n}`,
               expectedETag: "etag",
            })),
            nextToken: "page-2",
         });
         await expect(
            transferObjects(
               input({
                  source: { folderKey: "raw/deep/" },
                  destination: {
                     serverId: "source-server",
                     bucketName: "photos",
                     prefix,
                  },
               })
            )
         ).rejects.toThrow("must not overlap");
         expect(h.get).not.toHaveBeenCalled();
         expect(h.post).not.toHaveBeenCalled();
      }
   );

   it("allows overlapping textual prefixes in different buckets", async () => {
      h.get.mockResolvedValue({
         objects: [{ key: "raw/deep/file", expectedETag: "etag" }],
         nextToken: null,
      });
      const summary = await transferObjects(
         input({
            source: { folderKey: "raw/deep/" },
            destination: {
               serverId: "source-server",
               bucketName: "other",
               prefix: "raw/",
            },
         })
      );
      expect(summary.transferred).toBe(1);
   });

   it.each(["raw/", "raw/deep/more/", ""])(
      "blocks strict overlap through a saved connection alias (%s)",
      async (prefix) => {
         await expect(
            transferObjects(
               input({
                  source: { folderKey: "raw/deep/" },
                  destination: {
                     serverId: "alias",
                     bucketName: "photos",
                     prefix,
                  },
                  overwrite: true,
               })
            )
         ).rejects.toThrow("must not overlap");
         expect(h.get).not.toHaveBeenCalled();
         expect(h.post).not.toHaveBeenCalled();
      }
   );

   it.each(["raw/deep/", "archive/"])(
      "allows identical or disjoint paths across connections (%s)",
      async (prefix) => {
         h.get.mockResolvedValue({
            objects: [{ key: "raw/deep/file", expectedETag: "etag" }],
            nextToken: null,
         });
         const result = await transferObjects(
            input({
               source: { folderKey: "raw/deep/" },
               destination: { serverId: "alias", bucketName: "photos", prefix },
            })
         );
         expect(result.transferred).toBe(1);
         expect(h.post.mock.calls[0]?.[1].destination.objectKey).toBe(
            `${prefix}file`
         );
      }
   );

   it("continues through every clean page after retaining a historical unknown outcome", async () => {
      const request = input({ source: { folderKey: "raw/" }, overwrite: true });
      const operation = createTransferOperation(request);
      for (let index = 1; index <= 4; index++) {
         h.get.mockResolvedValueOnce({
            objects: [{ key: `raw/${index}`, expectedETag: `etag-${index}` }],
            nextToken: index === 4 ? null : `page-${index + 1}`,
         });
      }
      h.post.mockRejectedValueOnce(new FakeApiError(500, "Response lost"));
      const first = await transferObjects({ ...request, operation });
      expect(first).toMatchObject({ transferred: 0, remaining: true });
      expect(h.get).toHaveBeenCalledOnce();
      const continued = await transferObjects({ ...request, operation });
      expect(continued).toMatchObject({
         transferred: 3,
         remaining: false,
         failed: [{ key: "raw/1", retryable: false, outcome: "unknown" }],
      });
      expect(h.get).toHaveBeenCalledTimes(4);
      expect(
         h.post.mock.calls.map(([, body]) => body.source.objectKey)
      ).toEqual(["raw/1", "raw/2", "raw/3", "raw/4"]);
   });

   it.each([
      {
         destination: {
            serverId: "other-server",
            bucketName: "changed",
            prefix: "2026/",
         },
      },
      {
         destination: {
            serverId: "changed",
            bucketName: "archive",
            prefix: "2026/",
         },
      },
      { overwrite: true },
   ])("rejects changed operation settings", async (change) => {
      const request = input();
      const operation = createTransferOperation(request);
      await expect(
         transferObjects({ ...request, ...change, operation })
      ).rejects.toThrow("Start a new copy");
      expect(h.post).not.toHaveBeenCalled();
   });
});

it.each([undefined, "RATE_LIMITED"])(
   "does not retry 429 without a definite pre-write marker (%s)",
   async (code) => {
      const request = input({ overwrite: true });
      const operation = createTransferOperation(request);
      h.post.mockRejectedValue(new FakeApiError(429, "Upstream refusal", code));
      await transferObjects({ ...request, operation });
      h.post.mockClear();
      const resumed = await transferObjects({ ...request, operation });
      expect(h.post).not.toHaveBeenCalled();
      expect(resumed.failed.every(({ retryable }) => !retryable)).toBe(true);
   }
);

describe("waiting out a rate limit on the read-only steps", () => {
   afterEach(() => vi.useRealTimers());
   const limited = () => new FakeApiError(429, "Too many requests.");
   const copied = { key: "", size: 1, eTag: null };

   it("retries the destination check with backoff instead of stopping the copy", async () => {
      vi.useFakeTimers();
      h.exists
         .mockRejectedValueOnce(limited())
         .mockRejectedValueOnce(limited())
         .mockResolvedValue({ existing: ["2026/a.png"], eTags: {} });
      h.post.mockResolvedValue(copied);
      const pending = transferObjects(input());
      await vi.advanceTimersByTimeAsync(1999);
      expect(h.exists).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(h.exists).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(3999);
      expect(h.exists).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      const summary = await pending;
      expect(h.exists).toHaveBeenCalledTimes(3);
      expect(summary).toMatchObject({
         transferred: 2,
         skipped: 1,
         listingError: null,
         remaining: false,
      });
   });

   it("retries the source listing and carries on from the same page", async () => {
      vi.useFakeTimers();
      h.get.mockRejectedValueOnce(limited()).mockResolvedValueOnce({
         objects: [{ key: "raw/one.txt", expectedETag: '"1"' }],
         nextToken: null,
      });
      h.exists.mockResolvedValue({ existing: [], eTags: {} });
      h.post.mockResolvedValue(copied);
      const pending = transferObjects(input({ source: { folderKey: "raw/" } }));
      await vi.runAllTimersAsync();
      const summary = await pending;
      expect(h.get).toHaveBeenCalledTimes(2);
      expect(h.get.mock.calls[1]?.[0]).toBe(h.get.mock.calls[0]?.[0]);
      expect(summary).toMatchObject({ transferred: 1, remaining: false });
   });

   it("gives up after about a minute and leaves the copy resumable", async () => {
      vi.useFakeTimers();
      h.exists.mockRejectedValue(limited());
      const operation = createTransferOperation(input());
      const pending = transferObjects({ ...input(), operation });
      await vi.advanceTimersByTimeAsync(61_999);
      expect(h.exists).toHaveBeenCalledTimes(5);
      await vi.advanceTimersByTimeAsync(1);
      const summary = await pending;
      expect(h.exists).toHaveBeenCalledTimes(6);
      expect(h.post).not.toHaveBeenCalled();
      expect(summary.listingError).toContain("Too many requests.");
      expect(summary.remaining).toBe(true);
      h.exists.mockReset().mockResolvedValue({ existing: [], eTags: {} });
      h.post.mockResolvedValue(copied);
      const resumed = await transferObjects({ ...input(), operation });
      expect(resumed).toMatchObject({ transferred: 3, remaining: false });
   });

   it("does not wait on any other refusal of a read", async () => {
      h.exists.mockRejectedValue(new FakeApiError(403, "Not allowed."));
      const summary = await transferObjects(input());
      expect(h.exists).toHaveBeenCalledOnce();
      expect(summary.listingError).toContain("Not allowed.");
   });

   it("stops waiting the moment the copy is cancelled", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      h.exists.mockRejectedValue(limited());
      const pending = transferObjects({
         ...input(),
         signal: controller.signal,
      });
      const rejected = expect(pending).rejects.toThrow("Request cancelled");
      await vi.advanceTimersByTimeAsync(100);
      controller.abort();
      await rejected;
      expect(h.exists).toHaveBeenCalledOnce();
   });

   it("still never retries a rate-limited copy without the not-started marker", async () => {
      h.exists.mockResolvedValue({ existing: [], eTags: {} });
      h.post.mockRejectedValue(limited());
      const summary = await transferObjects(input());
      expect(h.post).toHaveBeenCalledTimes(3);
      expect(summary.failed.every(({ retryable }) => !retryable)).toBe(true);
   });
});
