import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";
import { UploadCancelled } from "@/lib/utils/s3/upload-cancelled";
import { ErrorCode } from "@s3-viewer/types";

vi.stubGlobal("localStorage", createMemoryStorage());

type Settle = {
   resolve: () => void;
   reject: (error: unknown) => void;
   abort: ReturnType<typeof vi.fn>;
   expectedETag?: string;
   onProgress: (loaded: number) => void;
};
const inFlight = new Map<string, Settle>();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@s3-viewer/ui/components/toast", () => ({ toast }));
vi.mock("@/lib/utils/s3/upload-object", () => ({
   uploadObject: ({
      serverId,
      bucketName,
      objectKey,
      expectedETag,
      onProgress,
   }: {
      serverId: string;
      bucketName: string;
      objectKey: string;
      expectedETag?: string;
      onProgress: (loaded: number) => void;
   }) => {
      let settle: Settle | undefined;
      const abort = vi.fn(() => settle?.reject(new UploadCancelled()));
      const done = new Promise<void>((resolve, reject) => {
         settle = { resolve, reject, abort, expectedETag, onProgress };
      });
      if (settle)
         inFlight.set(
            JSON.stringify([serverId, bucketName, objectKey]),
            settle
         );
      return { done, abort };
   },
}));

const { default: useUploadStore } = await import("./upload-store");
const { suspendUploads } = await import("./lifecycle");
const { default: useSessionStore } = await import("@/lib/stores/session-store");

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const file = (name: string) => ({
   file: new File(["x".repeat(10)], name),
   relativePath: name,
});
const enqueue = (...names: string[]) =>
   useUploadStore.getState().enqueue({
      files: names.map(file),
      serverId: "s",
      bucketName: "b",
      prefix: "p/",
   });
const uploadId = (name: string, serverId = "s") =>
   JSON.stringify([serverId, "b", `p/${name}`]);
const status = (name: string, serverId = "s") =>
   useUploadStore.getState().entries[uploadId(name, serverId)]?.status;
const finish = async (name: string, serverId = "s") => {
   inFlight.get(uploadId(name, serverId))?.resolve();
   await flush();
};
const fail = async (name: string, serverId = "s") => {
   inFlight.get(uploadId(name, serverId))?.reject(new Error("boom"));
   await flush();
};

beforeEach(async () => {
   await useUploadStore.getState().cancelAllAndClear();
   useSessionStore.getState().setUserId("user-a");
   inFlight.clear();
   toast.success.mockClear();
   toast.error.mockClear();
});

afterEach(() => vi.useRealTimers());

describe("uploadStore", () => {
   it("updates only the changed row without copying upload history and retains bytes on failure", async () => {
      enqueue("a", "b");
      const snapshot = useUploadStore.getState();
      const sibling = snapshot.entries[uploadId("b")];
      const first = inFlight.get(uploadId("a"))!;
      first.onProgress(10);
      expect(useUploadStore.getState().entries).toBe(snapshot.entries);
      expect(useUploadStore.getState().order).toBe(snapshot.order);
      expect(useUploadStore.getState().progress).toEqual({
         [uploadId("a")]: 10,
      });
      await fail("a");
      expect(useUploadStore.getState().entries[uploadId("a")]).toMatchObject({
         status: "failed",
         uploadedBytes: 10,
      });
      expect(useUploadStore.getState().progress).toEqual({});
      expect(useUploadStore.getState().entries[uploadId("b")]).toBe(sibling);
      first.onProgress(100);
      expect(useUploadStore.getState().progress).toEqual({});
   });

   it("clears progress on cancellation, replacement, and account changes", async () => {
      enqueue("a");
      const first = inFlight.get(uploadId("a"))!;
      first.onProgress(10);
      useUploadStore.getState().cancel(uploadId("a"));
      first.onProgress(10);
      expect(useUploadStore.getState().progress).toEqual({});
      await flush();
      enqueue("a");
      first.onProgress(10);
      expect(useUploadStore.getState().progress).toEqual({});
      inFlight.get(uploadId("a"))!.onProgress(10);
      useSessionStore.getState().setUserId("user-b");
      expect(useUploadStore.getState().progress).toEqual({});
   });

   it("bounds completed history while retaining failures and exact batch totals", async () => {
      enqueue("template");
      await finish("template");
      const template = useUploadStore.getState().entries[uploadId("template")]!;
      const entries = Object.fromEntries(
         Array.from({ length: 1_000 + 5 }, (_, i) => {
            const id = `history-${i}`;
            return [id, { ...template, id }];
         })
      );
      entries.failure = {
         ...template,
         id: "failure",
         status: "failed",
         error: "Retry me",
      };
      useUploadStore.setState({ entries, order: Object.keys(entries) });
      const onSettled = vi.fn();
      useUploadStore.getState().enqueue({
         files: [file("latest")],
         serverId: "s",
         bucketName: "b",
         prefix: "p/",
         onSettled,
      });
      await finish("latest");
      const state = useUploadStore.getState();
      expect(state.order).toHaveLength(1_000 + 1);
      expect(state.entries["history-0"]).toBeUndefined();
      expect(state.entries.failure?.error).toBe("Retry me");
      expect(state.entries[uploadId("latest")]?.status).toBe("completed");
      expect(state.batch).toMatchObject({
         completed: 1,
         failed: 0,
         settled: true,
      });
      expect(onSettled).toHaveBeenCalledOnce();
   });

   it.each([null, "user-b"])(
      "aborts active files and erases queued files and results when identity becomes %s",
      async (userId) => {
         const onSettled = vi.fn();
         useUploadStore.getState().enqueue({
            files: ["a", "b", "c", "private-fourth.txt"].map(file),
            serverId: "s",
            bucketName: "b",
            prefix: "p/",
            onSettled,
         });
         const previous = [...inFlight.values()];
         useSessionStore.getState().setUserId(userId);
         expect(previous).toHaveLength(3);
         for (const job of previous) expect(job.abort).toHaveBeenCalledOnce();
         await flush();
         expect(useUploadStore.getState()).toMatchObject({
            entries: {},
            order: [],
            batch: null,
            isUploading: false,
         });
         expect(inFlight.has(uploadId("private-fourth.txt"))).toBe(false);
         expect(onSettled).toHaveBeenCalledExactlyOnceWith([
            "p/a",
            "p/b",
            "p/c",
         ]);
         expect(toast.success).not.toHaveBeenCalled();
      }
   );

   it("does not resurrect a large enqueue after an account changes between chunks", async () => {
      enqueue(...Array.from({ length: 401 }, (_, i) => `private-${i}`));
      expect(useUploadStore.getState().order).toHaveLength(200);
      useSessionStore.getState().setUserId("user-b");
      enqueue("new-account-file");
      await flush();
      expect(useUploadStore.getState().order).toEqual([
         uploadId("new-account-file"),
      ]);
      await finish("new-account-file");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 0,
         settled: true,
      });
   });

   it("refuses enqueue without a user and preserves uploads across same-user server navigation", async () => {
      useSessionStore.getState().clearSession();
      enqueue("signed-out-file");
      expect(inFlight.size).toBe(0);
      useSessionStore.getState().setUserId("user-a");
      enqueue("a", "b", "c", "d");
      useSessionStore.getState().setServerId("other-server");
      useSessionStore.getState().setUserId("user-a");
      for (const job of inFlight.values())
         expect(job.abort).not.toHaveBeenCalled();
      await finish("a");
      expect(status("d")).toBe("active");
   });

   it("keeps three uploads active and settles the batch with exact counts", async () => {
      enqueue("a", "b", "c", "d", "e");
      expect(["a", "b", "c"].map((name) => status(name))).toEqual([
         "active",
         "active",
         "active",
      ]);
      expect(status("d")).toBe("pending");
      expect(status("e")).toBe("pending");

      await finish("a");
      expect(status("d")).toBe("active");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 0,
      });

      useUploadStore.getState().cancel(uploadId("e"));
      expect(status("e")).toBe("cancelled");

      await fail("b");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 1,
      });

      enqueue("b");
      expect(status("b")).toBe("active");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 0,
      });

      await finish("b");
      await finish("c");
      await finish("d");
      const { batch, isUploading } = useUploadStore.getState();
      expect(batch).toMatchObject({ settled: true, completed: 4, failed: 0 });
      expect(isUploading).toBe(false);
      expect(toast.success).toHaveBeenCalledWith("4 files uploaded.");
   });

   it("re-enqueuing an active file aborts it and starts over once", async () => {
      enqueue("a");
      const first = inFlight.get(uploadId("a"))!;
      enqueue("a");
      expect(first.abort).toHaveBeenCalledOnce();
      await flush();
      expect(status("a")).toBe("active");
      await finish("a");
      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 1,
         ids: [uploadId("a")],
      });
   });

   it("dedupes files that share a key within one enqueue call and warns about it", async () => {
      useUploadStore.getState().enqueue({
         files: [
            { file: new File(["1"], "first.txt"), relativePath: "dup.txt" },
            { file: new File(["22"], "second.txt"), relativePath: "dup.txt" },
         ],
         serverId: "s",
         bucketName: "b",
         prefix: "p/",
      });
      await flush();
      expect(useUploadStore.getState().order).toEqual([uploadId("dup.txt")]);
      expect(status("dup.txt")).toBe("active");
      expect(
         useUploadStore.getState().entries[uploadId("dup.txt")]
      ).toMatchObject({ fileName: "second.txt" });
      expect(toast.error).toHaveBeenCalledWith(
         expect.stringContaining("a name with another in this drop")
      );

      await finish("dup.txt");
      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 1,
         ids: [uploadId("dup.txt")],
      });
   });

   it("cancelAll aborts active uploads and drops queued ones in one pass", async () => {
      enqueue("a", "b", "c", "d");
      useUploadStore.getState().cancelAll();
      await flush();
      expect(["a", "b", "c", "d"].map((name) => status(name))).toEqual([
         "cancelled",
         "cancelled",
         "cancelled",
         "cancelled",
      ]);
      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 0,
         failed: 0,
      });
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
   });

   it("cancelAll during a large drop stops later chunks from being queued and still settles the batch", async () => {
      vi.useFakeTimers();
      const names = Array.from({ length: 450 }, (_, i) => `f${i}`);
      enqueue(...names);
      expect(useUploadStore.getState().order).toHaveLength(200);

      useUploadStore.getState().cancelAll();
      await vi.runAllTimersAsync();

      const { order, entries, batch, isUploading } = useUploadStore.getState();
      expect(order).toHaveLength(200);
      expect(order.every((id) => entries[id]?.status === "cancelled")).toBe(
         true
      );
      expect(batch).toMatchObject({ settled: true, completed: 0, failed: 0 });
      expect(batch?.ids).toHaveLength(200);
      expect(isUploading).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
   });

   it("keeps one batch's ids unique when a second large drop interleaves with it", async () => {
      const first = Array.from({ length: 450 }, (_, i) => `h${i}`);
      const second = Array.from({ length: 450 }, (_, i) => `i${i}`);
      enqueue(...first);
      enqueue(...second);
      await vi.waitFor(() =>
         expect(useUploadStore.getState().order).toHaveLength(900)
      );

      const { batch } = useUploadStore.getState();
      expect(batch?.ids).toHaveLength(900);
      expect(new Set(batch?.ids).size).toBe(900);
   });

   it("still reloads the listing for files that finished before a clear", async () => {
      const onSettled = vi.fn();
      useUploadStore.getState().enqueue({
         files: ["a", "b"].map(file),
         serverId: "s",
         bucketName: "b",
         prefix: "p/",
         onSettled,
      });
      await finish("a");
      expect(onSettled).not.toHaveBeenCalled();
      await useUploadStore.getState().cancelAllAndClear();
      expect(onSettled).toHaveBeenCalledExactlyOnceWith(["p/a", "p/b"]);
   });

   it("waits for cleanup from a replaced job that no longer owns its key", async () => {
      enqueue("a");
      const previous = inFlight.get(uploadId("a"))!;
      previous.abort.mockImplementation(() => undefined);
      enqueue("a");
      expect(previous.abort).toHaveBeenCalledOnce();
      const cleared = useUploadStore.getState().cancelAllAndClear();
      const settled = vi.fn();
      void cleared.then(settled);
      await flush();
      expect(settled).not.toHaveBeenCalled();
      previous.reject(new UploadCancelled());
      await cleared;
      expect(settled).toHaveBeenCalledOnce();
      expect(useUploadStore.getState().entries).toEqual({});
   });

   it("waits for an already cancelled worker without aborting it twice", async () => {
      enqueue("a");
      const previous = inFlight.get(uploadId("a"))!;
      previous.abort.mockImplementation(() => undefined);
      useUploadStore.getState().cancel(uploadId("a"));
      const cleared = useUploadStore.getState().cancelAllAndClear();
      const settled = vi.fn();
      void cleared.then(settled);
      await flush();
      expect(settled).not.toHaveBeenCalled();
      expect(previous.abort).toHaveBeenCalledOnce();
      previous.reject(new UploadCancelled());
      await cleared;
      expect(settled).toHaveBeenCalledOnce();
   });

   it("suspends fresh uploads and prevents old enqueue chunks from restarting", async () => {
      enqueue(...Array.from({ length: 450 }, (_, i) => `f${i}`));
      expect(useUploadStore.getState().order).toHaveLength(200);
      const resume = suspendUploads();
      try {
         await useUploadStore.getState().cancelAllAndClear();
         enqueue("during-cleanup");
         await flush();
         await flush();
         expect(useUploadStore.getState().order).toEqual([]);
         expect(inFlight.size).toBe(3);
      } finally {
         resume();
      }
      resume();
      enqueue("after-cleanup");
      expect(status("after-cleanup")).toBe("active");
   });

   it("invalidates attempted uploads independently across servers even when a response fails", async () => {
      const firstComplete = vi.fn();
      const secondComplete = vi.fn();
      for (const [serverId, onSettled] of [
         ["first", firstComplete],
         ["second", secondComplete],
      ] as const) {
         useUploadStore.getState().enqueue({
            files: [file("backup.sql")],
            serverId,
            bucketName: "b",
            prefix: "p/",
            onSettled,
         });
      }
      expect(
         inFlight.get(uploadId("backup.sql", "first"))?.abort
      ).not.toHaveBeenCalled();
      await fail("backup.sql", "first");
      expect(status("backup.sql", "second")).toBe("active");
      expect(useUploadStore.getState().batch?.settled).toBe(false);
      await finish("backup.sql", "second");
      expect(status("backup.sql", "first")).toBe("failed");
      expect(status("backup.sql", "second")).toBe("completed");
      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 1,
         failed: 1,
      });
      expect(firstComplete).toHaveBeenCalledExactlyOnceWith(["p/backup.sql"]);
      expect(secondComplete).toHaveBeenCalledExactlyOnceWith(["p/backup.sql"]);
      expect(toast.error).toHaveBeenCalledWith(
         "1 of 2 files uploaded. 1 failed."
      );
   });

   it("explains a folder refusal once for the whole batch", async () => {
      const { ApiError } = await import("@/lib/api");
      const message = "Your access to this bucket is limited to landing/";
      enqueue("a", "b");
      for (const name of ["a", "b"]) {
         inFlight
            .get(uploadId(name))
            ?.reject(new ApiError(403, message, ErrorCode.FOLDER_ACCESS));
         await flush();
      }
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
         "0 of 2 files uploaded. 2 failed.",
         { description: message }
      );
   });

   it("passes only each file's explicit full-key ETag to its upload", () => {
      useUploadStore.getState().enqueue({
         files: [file("replacement.txt"), file("new.txt"), file("constructor")],
         serverId: "s",
         bucketName: "b",
         prefix: "p/",
         eTags: Object.assign(
            Object.create({ "p/constructor": '"inherited"' }),
            {
               "p/replacement.txt": '"observed-etag"',
            }
         ) as Record<string, string>,
      });
      expect(inFlight.get(uploadId("replacement.txt"))?.expectedETag).toBe(
         '"observed-etag"'
      );
      expect(inFlight.get(uploadId("new.txt"))?.expectedETag).toBeUndefined();
      expect(
         inFlight.get(uploadId("constructor"))?.expectedETag
      ).toBeUndefined();
   });
});

it("coalesces settled chunks into one bucket callback including unknown write outcomes", async () => {
   const callbacks = [vi.fn(), vi.fn(), vi.fn()];
   for (const [index, name] of ["a", "b", "c"].entries()) {
      useUploadStore.getState().enqueue({
         files: [file(name)],
         serverId: "s",
         bucketName: "b",
         prefix: "p/",
         onSettled: callbacks[index],
      });
   }
   await finish("a");
   await fail("b");
   await finish("c");
   expect(callbacks[0]).not.toHaveBeenCalled();
   expect(callbacks[1]).not.toHaveBeenCalled();
   expect(callbacks[2]).toHaveBeenCalledExactlyOnceWith(["p/a", "p/b", "p/c"]);
});

it("invalidates interrupted active uploads but excludes files cancelled while queued", async () => {
   const onSettled = vi.fn();
   useUploadStore.getState().enqueue({
      files: ["a", "b", "c", "queued"].map(file),
      serverId: "s",
      bucketName: "b",
      prefix: "p/",
      onSettled,
   });
   useUploadStore.getState().cancelAll();
   await flush();
   expect(inFlight.has(uploadId("queued"))).toBe(false);
   expect(onSettled).toHaveBeenCalledExactlyOnceWith(["p/a", "p/b", "p/c"]);
});

it("retains attempted keys when an earlier success is superseded by a failed same-key upload", async () => {
   const onSettled = vi.fn();
   const request = {
      files: [file("replacement"), file("sibling")],
      serverId: "s",
      bucketName: "b",
      prefix: "p/",
      onSettled,
   };
   useUploadStore.getState().enqueue(request);
   await finish("replacement");
   useUploadStore
      .getState()
      .enqueue({ ...request, files: [file("replacement")] });
   await fail("replacement");
   await finish("sibling");
   expect(status("replacement")).toBe("failed");
   expect(onSettled).toHaveBeenCalledExactlyOnceWith([
      "p/replacement",
      "p/sibling",
   ]);
});
