import { ApiError } from "@/lib/api";
import { FakeXHR } from "@/lib/test/fake-xhr";
import { expectUploadSlotsFree } from "@/lib/test/upload-slots";
import { createWebLocks } from "@/lib/test/web-locks";
import { MULTIPART_CONCURRENCY } from "@s3-viewer/types";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";
import type { MultipartSession } from "./multipart-session";
import { UploadCancelled } from "./upload-cancelled";

const identity = vi.hoisted(() => ({ userId: "user-a" as string | null }));
vi.mock("@/lib/stores/session-store", () => ({
   default: { getState: () => identity, subscribe: () => () => {} },
}));

const server = vi.hoisted(() => ({
   get: vi.fn(),
   post: vi.fn(),
   remove: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
   const actual = await importOriginal<typeof import("@/lib/api")>();
   return {
      ...actual,
      api: {
         ...actual.api,
         get: server.get,
         post: server.post,
         delete: server.remove,
      },
   };
});

vi.stubGlobal("XMLHttpRequest", FakeXHR);

const storage = createMemoryStorage();
const { memory } = storage;
vi.stubGlobal("localStorage", storage);

const { uploadMultipart } = await import("./upload-multipart");
const { rememberSession } = await import("./multipart-session");
const { uploadSlot } = await import("./slot-pool");

const PART_SIZE = 5;
const FILE_SIZE = 12;
const uploaded = { key: "k", size: FILE_SIZE, eTag: '"whole"' };

const makeFile = (size = FILE_SIZE, lastModified = 1000) =>
   new File(["x".repeat(size)], "big.bin", { lastModified });

const start = (
   overrides: {
      file?: File;
      expectedETag?: string;
      onProgress?: (loaded: number) => void;
   } = {}
) =>
   uploadMultipart({
      userId: "user-a",
      serverId: "s",
      bucketName: "b",
      objectKey: "k",
      file: overrides.file ?? makeFile(),
      contentType: "application/zip",
      expectedETag: overrides.expectedETag,
      onProgress: overrides.onProgress ?? vi.fn(),
   });

const settle = () => vi.advanceTimersByTimeAsync(0);

const savedSessions = (): Record<string, MultipartSession> => {
   const sessions = JSON.parse(
      memory.get("s3-viewer.multipart-uploads") ?? "{}"
   ) as Record<string, MultipartSession>;
   for (const [target, session] of Object.entries(sessions)) {
      session.partDigests = {};
      for (const [key, value] of memory) {
         const prefix = "s3-viewer.multipart-uploads.parts.";
         if (!key.startsWith(prefix)) continue;
         const [userId, savedTarget, uploadId] = JSON.parse(
            key.slice(prefix.length)
         );
         if (
            userId === session.userId &&
            savedTarget === target &&
            uploadId === session.uploadId
         )
            Object.assign(session.partDigests, JSON.parse(value));
      }
   }
   return sessions;
};

const serveParts = (partCount: number) =>
   server.post.mockImplementation((path: string) =>
      path.endsWith("/complete")
         ? Promise.resolve(uploaded)
         : Promise.resolve({
              key: "k",
              uploadId: "u1",
              partSize: PART_SIZE,
              partCount,
           })
   );

const openAs = (uploadId: string, partCount = 3) =>
   server.post.mockResolvedValueOnce({
      key: "k",
      uploadId,
      partSize: PART_SIZE,
      partCount,
   });

const ack = (xhr: FakeXHR) =>
   xhr.respond(200, {
      partNumber: xhr.partNumber,
      eTag: `"p${xhr.partNumber}"`,
      size: xhr.body?.size ?? 0,
   });

const expectDiscarded = (uploadId: string) =>
   expect(server.remove).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ uploadId })
   );

const partsFor = (numbers: number[]) =>
   FakeXHR.instances.filter((xhr) => numbers.includes(xhr.partNumber));

const ackAll = () => {
   for (const xhr of FakeXHR.instances)
      if (xhr.readyState !== FakeXHR.DONE) ack(xhr);
};

beforeEach(() => {
   identity.userId = "user-a";
   vi.stubGlobal("navigator", { locks: createWebLocks() });
   FakeXHR.instances = [];
   memory.clear();
   vi.spyOn(Math, "random").mockReturnValue(0.5);
   // real SHA-256 without Web Crypto, which works outside the fake timer queue.
   vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(
      async (_algorithm, data) =>
         Uint8Array.from(
            createHash("sha256")
               .update(new Uint8Array(data as ArrayBuffer))
               .digest()
         ).buffer
   );
   server.get.mockReset().mockResolvedValue({ parts: [] });
   server.remove.mockReset().mockResolvedValue(undefined);
   server.post.mockReset();
   serveParts(Math.ceil(FILE_SIZE / PART_SIZE));
   vi.useFakeTimers();
});

afterEach(async () => {
   vi.useRealTimers();
   vi.restoreAllMocks();
   await expectUploadSlotsFree();
});

describe("sending a large file as parts", () => {
   it("slices the file to the plan and commits the parts in order", async () => {
      const handle = start();
      await settle();
      expect(server.post.mock.calls[0]?.[1]).toMatchObject({
         objectKey: "k",
         totalBytes: FILE_SIZE,
         contentType: "application/zip",
         expectedUserId: "user-a",
      });
      expect(FakeXHR.instances).toHaveLength(3);
      expect(FakeXHR.instances.map((xhr) => xhr.body?.size)).toEqual([5, 5, 2]);
      expect(FakeXHR.instances[0]?.headers["Content-Type"]).toBe(
         "application/octet-stream"
      );
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);

      const complete = server.post.mock.calls.at(-1);
      expect(complete?.[0]).toContain("/multipart-uploads/complete");
      expect(complete?.[1]).toMatchObject({
         uploadId: "u1",
         parts: [
            { partNumber: 1, eTag: '"p1"' },
            { partNumber: 2, eTag: '"p2"' },
            { partNumber: 3, eTag: '"p3"' },
         ],
      });
   });

   it("waits for slots held by other uploads in the tab", async () => {
      let release = () => {};
      const held = Array.from({ length: MULTIPART_CONCURRENCY }, (_, index) =>
         uploadSlot(
            `other-${index}`,
            () =>
               new Promise<void>((resolve) => {
                  const previous = release;
                  release = () => {
                     previous();
                     resolve();
                  };
               })
         )
      );
      const handle = start();
      await settle();
      expect(FakeXHR.instances).toHaveLength(0);
      release();
      await Promise.all(held);
      await settle();
      expect(FakeXHR.instances).toHaveLength(3);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it("reports progress across finished parts and the one in flight", async () => {
      const onProgress = vi.fn();
      const handle = start({ onProgress });
      await settle();
      partsFor([1])[0]?.progress(3);
      expect(onProgress).toHaveBeenLastCalledWith(3);
      ack(partsFor([1])[0]!);
      partsFor([2])[0]?.progress(4);
      expect(onProgress).toHaveBeenLastCalledWith(9);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(onProgress).toHaveBeenLastCalledWith(FILE_SIZE);
   });

   it("uploads successfully when reading browser storage throws", async () => {
      vi.spyOn(storage, "getItem").mockImplementation(() => {
         throw new Error("Storage unavailable");
      });
      const handle = start();
      await settle();
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });
});

describe("retrying one part instead of the file", () => {
   it("re-sends only the part that failed", async () => {
      const handle = start();
      await settle();
      partsFor([1, 3]).forEach(ack);
      partsFor([2])[0]?.fail();
      await vi.advanceTimersByTimeAsync(500);
      expect(FakeXHR.instances).toHaveLength(4);
      const retry = FakeXHR.instances[3];
      expect(retry?.partNumber).toBe(2);
      expect(retry?.body?.size).toBe(5);
      retry?.respond(200, { partNumber: 2, eTag: '"p2b"', size: 5 });
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(server.post.mock.calls.at(-1)?.[1]).toMatchObject({
         parts: expect.arrayContaining([{ partNumber: 2, eTag: '"p2b"' }]),
      });
   });

   it("gives up after the attempt bound and leaves the upload resumable", async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toMatchObject({ status: 0 });
      await settle();
      partsFor([2, 3]).forEach(ack);
      for (let attempt = 0; attempt < 5; attempt++) {
         const pending = FakeXHR.instances.filter(
            (xhr) => xhr.partNumber === 1 && xhr.readyState !== FakeXHR.DONE
         );
         pending.forEach((xhr) => xhr.fail());
         await vi.advanceTimersByTimeAsync(10_000);
      }
      await failed;
      expect(
         FakeXHR.instances.filter((xhr) => xhr.partNumber === 1)
      ).toHaveLength(5);
      expect(server.remove).not.toHaveBeenCalled();
      expect(Object.values(savedSessions())).toEqual([
         expect.objectContaining({ uploadId: "u1" }),
      ]);
   });

   it("reports an unknown outcome when a retried completion finds the upload already committed", async () => {
      const completions = [
         new ApiError(0, "lost"),
         new ApiError(404, "Object not found"),
      ];
      server.post.mockImplementation((path: string) =>
         path.endsWith("/complete")
            ? Promise.reject(completions.shift())
            : Promise.resolve({
                 key: "k",
                 uploadId: "u1",
                 partSize: PART_SIZE,
                 partCount: 3,
              })
      );
      const handle = start();
      const failed = expect(handle.done).rejects.toMatchObject({
         code: "UPLOAD_OUTCOME_UNKNOWN",
      });
      await settle();
      ackAll();
      await vi.advanceTimersByTimeAsync(10_000);
      await failed;
      expect(completions).toEqual([]);
   });

   it("aborts the sibling parts still in flight when one fails for good", async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toMatchObject({ status: 403 });
      await settle();
      const aborts = partsFor([2, 3]).map((xhr) => vi.spyOn(xhr, "abort"));
      partsFor([1])[0]?.respond(403, { message: "Denied." });
      await failed;
      aborts.forEach((abort) => expect(abort).toHaveBeenCalledOnce());
      expect(server.remove).not.toHaveBeenCalled();
   });

   it("hands its slot on while it waits out the backoff", async () => {
      const partCount = MULTIPART_CONCURRENCY + 1;
      serveParts(partCount);
      const handle = start({ file: makeFile(PART_SIZE * partCount) });
      await settle();
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY);
      partsFor([1])[0]?.fail();
      await settle();
      expect(FakeXHR.instances.map((xhr) => xhr.partNumber)).toContain(
         partCount
      );
      expect(partsFor([1])).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(500);
      for (let round = 0; round < 3; round++) {
         ackAll();
         await settle();
      }
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(partsFor([1])).toHaveLength(2);
   });

   it("stops a sibling waiting out its backoff when another part fails for good", async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toMatchObject({ status: 403 });
      await settle();
      partsFor([2])[0]?.fail();
      await settle();
      partsFor([1])[0]?.respond(403, { message: "Denied." });
      await failed;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(
         FakeXHR.instances.filter((xhr) => xhr.partNumber === 2)
      ).toHaveLength(1);
      expect(server.remove).not.toHaveBeenCalled();
   });
});

describe("resuming an interrupted upload", () => {
   const resumeAfterFailure = async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toBeDefined();
      await settle();
      partsFor([1, 2]).forEach(ack);
      partsFor([3])[0]?.respond(403, { message: "no" });
      await failed;
      FakeXHR.instances = [];
      server.post.mockClear();
   };

   it("verifies an identical reselected file and sends only the remaining parts", async () => {
      await resumeAfterFailure();
      const saved = Object.values(savedSessions())[0];
      expect(saved?.partDigests).toEqual({
         1: {
            eTag: '"p1"',
            sha256: createHash("sha256").update("xxxxx").digest("hex"),
         },
         2: {
            eTag: '"p2"',
            sha256: createHash("sha256").update("xxxxx").digest("hex"),
         },
      });
      server.get.mockResolvedValue({
         parts: [
            { partNumber: 1, eTag: '"p1"', size: 5 },
            { partNumber: 2, eTag: '"p2"', size: 5 },
         ],
      });
      const onProgress = vi.fn();
      const handle = start({ onProgress });
      await settle();
      expect(server.post).not.toHaveBeenCalledWith(
         expect.stringMatching(/multipart-uploads$/),
         expect.anything()
      );
      expect(onProgress).toHaveBeenCalledWith(10);
      expect(FakeXHR.instances).toHaveLength(1);
      expect(FakeXHR.instances[0]?.partNumber).toBe(3);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(server.post.mock.calls.at(-1)?.[1]).toMatchObject({
         uploadId: "u1",
         parts: [
            { partNumber: 1, eTag: '"p1"' },
            { partNumber: 2, eTag: '"p2"' },
            { partNumber: 3, eTag: '"p3"' },
         ],
      });
   });

   it("restarts when a reselected file has the same metadata but different bytes", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({
         parts: [
            { partNumber: 1, eTag: '"p1"', size: 5 },
            { partNumber: 2, eTag: '"p2"', size: 5 },
         ],
      });
      openAs("u2");
      const file = new File(["y".repeat(FILE_SIZE)], "big.bin", {
         lastModified: 1000,
      });
      const handle = start({ file });
      await settle();
      expectDiscarded("u1");
      expect(FakeXHR.instances.map((xhr) => xhr.partNumber).sort()).toEqual([
         1, 2, 3,
      ]);
      expect(
         await Promise.all(FakeXHR.instances.map((xhr) => xhr.body!.text()))
      ).toEqual(["yyyyy", "yyyyy", "yy"]);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(server.post.mock.calls.at(-1)?.[1]).toMatchObject({
         uploadId: "u2",
      });
   });

   it("verifies only reused slices, allowing different bytes in the remaining part", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({
         parts: [
            { partNumber: 1, eTag: '"p1"', size: 5 },
            { partNumber: 2, eTag: '"p2"', size: 5 },
         ],
      });
      vi.mocked(globalThis.crypto.subtle.digest).mockClear();
      const handle = start({
         file: new File(["xxxxxxxxxxyy"], "big.bin", { lastModified: 1000 }),
      });
      await settle();
      expect(FakeXHR.instances.map((xhr) => xhr.partNumber)).toEqual([3]);
      expect(await FakeXHR.instances[0]!.body!.text()).toBe("yy");
      expect(
         vi
            .mocked(globalThis.crypto.subtle.digest)
            .mock.calls.map(([, bytes]) => bytes.byteLength)
      ).toEqual([5, 5, 2]);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it.each([
      [
         "a malformed digest",
         (saved: MultipartSession) => {
            saved.partDigests![1]!.sha256 = "unknown";
         },
      ],
      [
         "a changed provider ETag",
         (saved: MultipartSession) => {
            saved.partDigests![1]!.eTag = '"old"';
         },
      ],
      [
         "an invalid part size",
         (saved: MultipartSession) => {
            Object.assign(saved, { partSize: 0 });
         },
      ],
      [
         "an inconsistent part count",
         (saved: MultipartSession) => {
            Object.assign(saved, { partCount: 1 });
         },
      ],
   ])(
      "restarts %s instead of reusing unverifiable parts",
      async (_name, change) => {
         await resumeAfterFailure();
         const [saved] = Object.values(savedSessions());
         change(saved!);
         await rememberSession(saved!);
         server.get.mockResolvedValue({
            parts: [{ partNumber: 1, eTag: '"p1"', size: 5 }],
         });
         const handle = start();
         await settle();
         expectDiscarded("u1");
         expect(FakeXHR.instances.map((xhr) => xhr.partNumber).sort()).toEqual([
            1, 2, 3,
         ]);
         ackAll();
         await expect(handle.done).resolves.toEqual(uploaded);
      }
   );

   it.each(["missing", "refused"])(
      "uploads fresh without touching a saved session when browser locks are %s",
      async (availability) => {
         await resumeAfterFailure();
         vi.mocked(globalThis.crypto.subtle.digest).mockClear();
         const before = new Map(memory);
         vi.stubGlobal(
            "navigator",
            availability === "missing"
               ? {}
               : {
                    locks: {
                       request: vi
                          .fn()
                          .mockRejectedValue(new Error("Locks refused")),
                    },
                 }
         );
         const reads = vi.spyOn(storage, "getItem");
         const writes = vi.spyOn(storage, "setItem");
         const removes = vi.spyOn(storage, "removeItem");
         openAs("u2");
         const handle = start();
         await settle();
         expect(server.get).not.toHaveBeenCalled();
         expect(FakeXHR.instances).toHaveLength(3);
         ackAll();
         await expect(handle.done).resolves.toEqual(uploaded);
         expect(reads).not.toHaveBeenCalled();
         expect(writes).not.toHaveBeenCalled();
         expect(removes).not.toHaveBeenCalled();
         expect(memory).toEqual(before);
         expect(globalThis.crypto.subtle.digest).not.toHaveBeenCalled();
      }
   );

   it("starts fresh if browser hashing becomes unavailable", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({
         parts: [{ partNumber: 1, eTag: '"p1"', size: 5 }],
      });
      vi.mocked(globalThis.crypto.subtle.digest).mockRejectedValue(
         new Error("Hash unavailable")
      );
      const handle = start();
      await settle();
      expect(server.remove).toHaveBeenCalledOnce();
      expect(FakeXHR.instances).toHaveLength(3);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it("starts fresh if browser storage refuses the required proof invalidation", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({ parts: [] });
      openAs("u2");
      vi.spyOn(storage, "setItem").mockImplementation(() => {
         throw new Error("Storage became read-only");
      });
      const handle = start();
      await settle();
      expectDiscarded("u1");
      expect(FakeXHR.instances).toHaveLength(3);
      expect(
         FakeXHR.instances.every(
            (xhr) =>
               new URL(xhr.url, "http://localhost").searchParams.get(
                  "uploadId"
               ) === "u2"
         )
      ).toBe(true);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it("does not reuse an overwritten part after its acknowledgement was lost", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({ parts: [] });
      const interrupted = start({
         file: new File(["y".repeat(FILE_SIZE)], "big.bin", {
            lastModified: 1000,
         }),
      });
      const failed = expect(interrupted.done).rejects.toMatchObject({
         status: 403,
      });
      await settle();
      expect(Object.values(savedSessions())[0]?.partDigests).toEqual({});
      partsFor([1])[0]!.respond(403, {
         message: "The successful write acknowledgement was lost",
      });
      await failed;
      FakeXHR.instances = [];
      server.get.mockResolvedValue({
         parts: [{ partNumber: 1, eTag: '"p1"', size: 5 }],
      });
      openAs("u2");
      const retry = start();
      await settle();
      expectDiscarded("u1");
      expect(FakeXHR.instances).toHaveLength(3);
      ackAll();
      await expect(retry.done).resolves.toEqual(uploaded);
      expect(server.post.mock.calls.at(-1)?.[1]).toMatchObject({
         uploadId: "u2",
      });
   });

   it("discards an upload cancelled while its resume storage lookup waits for a lock", async () => {
      await resumeAfterFailure();
      let release!: () => void;
      let entered!: () => void;
      const acquired = new Promise<void>((resolve) => {
         entered = resolve;
      });
      const held = navigator.locks.request(
         "s3-viewer.multipart-storage",
         () => {
            entered();
            return new Promise<void>((resolve) => {
               release = resolve;
            });
         }
      );
      await acquired;
      const handle = start();
      const cancelled = expect(handle.done).rejects.toBeInstanceOf(
         UploadCancelled
      );
      await settle();
      handle.abort();
      release();
      await held;
      await cancelled;
      expect(server.get).not.toHaveBeenCalled();
      expect(server.post).not.toHaveBeenCalled();
      expect(server.remove).toHaveBeenCalledExactlyOnceWith(
         expect.any(String),
         expect.objectContaining({ uploadId: "u1" })
      );
      expect(FakeXHR.instances).toHaveLength(0);
      expect(savedSessions()).toEqual({});
   });

   it("does not start a fresh upload after cancellation during the resume lookup", async () => {
      await resumeAfterFailure();
      let finishLookup!: (value: { parts: [] }) => void;
      server.get.mockImplementation(
         () =>
            new Promise((resolve) => {
               finishLookup = resolve;
            })
      );
      const handle = start();
      const failed = expect(handle.done).rejects.toBeInstanceOf(
         UploadCancelled
      );
      await settle();
      handle.abort();
      finishLookup({ parts: [] });
      await failed;
      expect(server.post).not.toHaveBeenCalled();
      expect(FakeXHR.instances).toHaveLength(0);
      expect(savedSessions()).toEqual({});
   });

   it("re-sends a stored part that does not cover its whole slice", async () => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({
         parts: [{ partNumber: 1, eTag: '"p1"', size: 2 }],
      });
      const handle = start();
      await settle();
      expect(FakeXHR.instances.map((xhr) => xhr.partNumber).sort()).toEqual([
         1, 2, 3,
      ]);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it("starts a new upload when storage no longer knows the saved one", async () => {
      await resumeAfterFailure();
      server.get.mockRejectedValue(new ApiError(404, "gone"));
      const handle = start();
      await settle();
      expect(FakeXHR.instances).toHaveLength(3);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });

   it.each([
      ["a different size", makeFile(FILE_SIZE + 1, 1000)],
      ["a newer timestamp", makeFile(FILE_SIZE, 2000)],
   ])("refuses to resume onto %s", async (_name, file) => {
      await resumeAfterFailure();
      server.get.mockResolvedValue({
         parts: [{ partNumber: 1, eTag: '"p1"', size: 5 }],
      });
      const handle = start({ file });
      await settle();
      expect(server.get).not.toHaveBeenCalled();
      expect(FakeXHR.instances).toHaveLength(3);
      ackAll();
      await expect(handle.done).resolves.toEqual(uploaded);
   });
});

describe("cancelling", () => {
   it("aborts the parts in flight and asks storage to discard the upload", async () => {
      const handle = start();
      await settle();
      const aborts = FakeXHR.instances.map((xhr) => vi.spyOn(xhr, "abort"));
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      aborts.forEach((abort) => expect(abort).toHaveBeenCalledOnce());
      expect(server.remove).toHaveBeenCalledWith(
         expect.stringContaining("/multipart-uploads/upload"),
         { objectKey: "k", uploadId: "u1", expectedUserId: "user-a" }
      );
      expect(savedSessions()).toEqual({});
   });

   it("discards an upload cancelled while it was still being opened", async () => {
      let finishOpening!: (value: unknown) => void;
      server.post.mockImplementationOnce(
         () =>
            new Promise((resolve) => {
               finishOpening = resolve;
            })
      );
      const handle = start();
      await settle();
      handle.abort();
      finishOpening({
         key: "k",
         uploadId: "u1",
         partSize: PART_SIZE,
         partCount: 3,
      });
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(FakeXHR.instances).toHaveLength(0);
      expect(server.remove).toHaveBeenCalledOnce();
   });

   it.each(["cancel", "account change"])(
      "bounds pending hashes and sends nothing after %s during hashing",
      async (stop) => {
         const finishes: Array<(value: ArrayBuffer) => void> = [];
         vi.mocked(globalThis.crypto.subtle.digest).mockImplementation(
            () =>
               new Promise((resolve) => {
                  finishes.push(resolve);
               })
         );
         const partCount = MULTIPART_CONCURRENCY + 2;
         openAs("u1", partCount);
         const handle = start({ file: makeFile(PART_SIZE * partCount) });
         const failed = expect(handle.done).rejects.toBeInstanceOf(
            UploadCancelled
         );
         await settle();
         expect(finishes).toHaveLength(MULTIPART_CONCURRENCY);
         expect(FakeXHR.instances).toHaveLength(0);
         if (stop === "cancel") handle.abort();
         else {
            identity.userId = "user-b";
            memory.clear();
         }
         finishes.forEach((finish) => finish(new ArrayBuffer(32)));
         await failed;
         await settle();
         expect(FakeXHR.instances).toHaveLength(0);
         expect(finishes).toHaveLength(MULTIPART_CONCURRENCY);
         expect(savedSessions()).toEqual({});
      }
   );

   it.each(["cancel", "complete"])(
      "keeps the owning session isolated when competing uploads %s",
      async (outcome) => {
         const older = start();
         await settle();
         openAs("u2");
         const newer = start({ file: makeFile(FILE_SIZE, 2000) });
         await settle();
         ack(partsFor([1])[0]!);
         await settle();
         expect(Object.values(savedSessions())).toEqual([
            expect.objectContaining({
               uploadId: "u1",
               partDigests: { 1: expect.any(Object) },
            }),
         ]);
         if (outcome === "cancel") {
            const failed = expect(older.done).rejects.toBeInstanceOf(
               UploadCancelled
            );
            older.abort();
            await failed;
         } else {
            partsFor([2, 3])
               .filter((xhr) => xhr.readyState !== FakeXHR.DONE)
               .forEach(ack);
            await older.done;
         }
         expect(savedSessions()).toEqual({});
         await settle();
         ackAll();
         await expect(newer.done).resolves.toEqual(uploaded);
      }
   );

   it("sends nothing once the account changes", async () => {
      identity.userId = "user-b";
      const handle = start();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(server.post).not.toHaveBeenCalled();
      expect(FakeXHR.instances).toHaveLength(0);
   });

   it("gives a second tab an independent upload ID while the first holds its resume lease", async () => {
      const first = start();
      await settle();
      const firstParts = [...FakeXHR.instances];
      vi.resetModules();
      const { uploadMultipart: otherTabUpload } = await import(
         "./upload-multipart"
      );
      openAs("u2");
      const second = otherTabUpload({
         userId: "user-a",
         ...{ serverId: "s", bucketName: "b", objectKey: "k" },
         file: new File(["y".repeat(FILE_SIZE)], "big.bin", {
            lastModified: 1000,
         }),
         contentType: "application/zip",
         onProgress: vi.fn(),
      });
      await settle();
      const secondParts = FakeXHR.instances.filter(
         (xhr) => !firstParts.includes(xhr)
      );
      expect(secondParts).toHaveLength(3);
      expect(
         secondParts.every(
            (xhr) =>
               new URL(xhr.url, "http://localhost").searchParams.get(
                  "uploadId"
               ) === "u2"
         )
      ).toBe(true);
      expect(server.get).not.toHaveBeenCalled();
      for (const xhr of secondParts)
         xhr.respond(200, {
            partNumber: xhr.partNumber,
            eTag: '"opaque-etag"',
            size: xhr.body!.size,
         });
      await expect(second.done).resolves.toEqual(uploaded);
      expect(Object.values(savedSessions())).toEqual([
         expect.objectContaining({ uploadId: "u1", partDigests: {} }),
      ]);
      ackAll();
      await expect(first.done).resolves.toEqual(uploaded);
      expect(savedSessions()).toEqual({});
   });

   it("holds the resume lease until cancelled upload cleanup settles", async () => {
      let finishCleanup!: () => void;
      server.remove.mockImplementationOnce(
         () =>
            new Promise<void>((resolve) => {
               finishCleanup = resolve;
            })
      );
      const first = start();
      const cancelled = expect(first.done).rejects.toBeInstanceOf(
         UploadCancelled
      );
      await settle();
      first.abort();
      await settle();
      expect(server.remove).toHaveBeenCalledOnce();
      let available: boolean | undefined;
      await navigator.locks.request(
         's3-viewer.multipart-upload.["user-a","s","b","k"]',
         { ifAvailable: true },
         (lock) => {
            available = lock !== null;
         }
      );
      expect(available).toBe(false);
      finishCleanup();
      await cancelled;
      await navigator.locks.request(
         's3-viewer.multipart-upload.["user-a","s","b","k"]',
         { ifAvailable: true },
         (lock) => {
            available = lock !== null;
         }
      );
      expect(available).toBe(true);
   });

   it("waits for aborted part transports before discarding their upload", async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toBeInstanceOf(
         UploadCancelled
      );
      await settle();
      for (const xhr of FakeXHR.instances)
         vi.spyOn(xhr, "abort").mockImplementation(() => undefined);
      handle.abort();
      await settle();
      expect(server.remove).not.toHaveBeenCalled();
      for (const xhr of FakeXHR.instances) xhr.onabort?.();
      await failed;
      expect(server.remove).toHaveBeenCalledOnce();
   });

   it("does not discard an upload whose pending completion succeeds after cancellation", async () => {
      let finishCompletion!: (value: typeof uploaded) => void;
      server.post.mockImplementation((path: string) =>
         path.endsWith("/complete")
            ? new Promise<typeof uploaded>((resolve) => {
                 finishCompletion = resolve;
              })
            : Promise.resolve({
                 key: "k",
                 uploadId: "u1",
                 partSize: PART_SIZE,
                 partCount: 3,
              })
      );
      const handle = start();
      await settle();
      ackAll();
      await settle();
      handle.abort();
      await settle();
      expect(server.remove).not.toHaveBeenCalled();
      finishCompletion(uploaded);
      await expect(handle.done).resolves.toEqual(uploaded);
      expect(server.remove).not.toHaveBeenCalled();
      expect(savedSessions()).toEqual({});
   });

   it("does not dispatch cleanup after the account changes during a storage lock wait", async () => {
      const handle = start();
      const failed = expect(handle.done).rejects.toBeInstanceOf(
         UploadCancelled
      );
      await settle();
      let releaseStorage!: () => void;
      const lock = navigator.locks.request(
         "s3-viewer.multipart-storage",
         () =>
            new Promise<void>((resolve) => {
               releaseStorage = resolve;
            })
      );
      await settle();
      handle.abort();
      await settle();
      expect(server.remove).not.toHaveBeenCalled();
      identity.userId = "user-b";
      releaseStorage();
      await lock;
      await failed;
      expect(server.remove).not.toHaveBeenCalled();
   });

   it("never opens a stream for a part still queued for a slot", async () => {
      const partCount = MULTIPART_CONCURRENCY + 1;
      serveParts(partCount);
      const handle = start({ file: makeFile(PART_SIZE * partCount) });
      await settle();
      expect(FakeXHR.instances).toHaveLength(MULTIPART_CONCURRENCY);
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(partsFor([partCount])).toHaveLength(0);
   });

   it("does not clean up a previous account's upload through a new account", async () => {
      const handle = start();
      await settle();
      identity.userId = "user-b";
      handle.abort();
      await expect(handle.done).rejects.toBeInstanceOf(UploadCancelled);
      expect(server.remove).not.toHaveBeenCalled();
   });
});
