import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadCancelled } from "@/lib/utils/s3/upload-cancelled";

type Settle = {
   resolve: () => void;
   reject: (error: unknown) => void;
   abort: ReturnType<typeof vi.fn>;
   expectedETag?: string;
};
const inFlight = new Map<string, Settle>();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@s3-viewer/ui/components/toast", () => ({ toast }));
vi.mock("@/lib/utils/s3/uploadObject", () => ({
   uploadObject: ({
      serverId,
      bucketName,
      objectKey,
      expectedETag,
   }: {
      serverId: string;
      bucketName: string;
      objectKey: string;
      expectedETag?: string;
   }) => {
      let settle: Settle | undefined;
      const abort = vi.fn(() => settle?.reject(new UploadCancelled()));
      const done = new Promise<void>((resolve, reject) => {
         settle = { resolve, reject, abort, expectedETag };
      });
      if (settle)
         inFlight.set(
            JSON.stringify([serverId, bucketName, objectKey]),
            settle
         );
      return { done, abort };
   },
}));

const { default: useUploadStore } = await import("./uploadStore");

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

beforeEach(() => {
   useUploadStore.getState().dismiss();
   inFlight.clear();
   toast.success.mockClear();
   toast.error.mockClear();
});

describe("uploadStore", () => {
   it("keeps three uploads active and settles the batch with exact counts", async () => {
      enqueue("a", "b", "c", "d", "e");
      expect(["a", "b", "c"].map((name) => status(name))).toEqual([
         "active",
         "active",
         "active",
      ]);
      expect(useUploadStore.getState().queue).toEqual([
         uploadId("d"),
         uploadId("e"),
      ]);

      await finish("a");
      expect(status("d")).toBe("active");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 0,
      });

      useUploadStore.getState().cancel(uploadId("e"));
      expect(status("e")).toBe("cancelled");
      expect(useUploadStore.getState().queue).toEqual([]);

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
      enqueue("a");
      await flush();
      expect(status("a")).toBe("active");
      expect(useUploadStore.getState().queue).toEqual([]);
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
      const names = Array.from({ length: 450 }, (_, i) => `f${i}`);
      enqueue(...names);
      // only the first chunk commits synchronously; the rest are still being
      // enqueued in the background.
      expect(useUploadStore.getState().order).toHaveLength(200);

      useUploadStore.getState().cancelAll();
      await flush();
      await flush();

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
      await flush();
      await flush();
      await flush();
      await flush();

      const { batch, order } = useUploadStore.getState();
      expect(order).toHaveLength(900);
      expect(batch?.ids).toHaveLength(900);
      expect(new Set(batch?.ids).size).toBe(900);
   });

   it("dismiss during a large drop clears everything and isn't resurrected by later chunks", async () => {
      const names = Array.from({ length: 450 }, (_, i) => `g${i}`);
      enqueue(...names);
      expect(useUploadStore.getState().order).toHaveLength(200);

      useUploadStore.getState().dismiss();
      await flush();
      await flush();

      const { order, entries, queue, batch } = useUploadStore.getState();
      expect(order).toEqual([]);
      expect(entries).toEqual({});
      expect(queue).toEqual([]);
      expect(batch).toBeNull();
   });

   it("completes same-path uploads on different servers independently", async () => {
      const firstComplete = vi.fn();
      const secondComplete = vi.fn();
      for (const [serverId, onComplete] of [
         ["first", firstComplete],
         ["second", secondComplete],
      ] as const) {
         useUploadStore.getState().enqueue({
            files: [file("backup.sql")],
            serverId,
            bucketName: "b",
            prefix: "p/",
            onComplete,
         });
      }
      expect(status("backup.sql", "first")).toBe("active");
      expect(status("backup.sql", "second")).toBe("active");
      expect(
         inFlight.get(uploadId("backup.sql", "first"))?.abort
      ).not.toHaveBeenCalled();
      expect(useUploadStore.getState().order).toHaveLength(2);

      await finish("backup.sql", "first");
      expect(status("backup.sql", "first")).toBe("completed");
      expect(status("backup.sql", "second")).toBe("active");
      expect(useUploadStore.getState().batch?.settled).toBe(false);
      await finish("backup.sql", "second");

      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 2,
         failed: 0,
         ids: [
            uploadId("backup.sql", "first"),
            uploadId("backup.sql", "second"),
         ],
      });
      expect(firstComplete).toHaveBeenCalledOnce();
      expect(secondComplete).toHaveBeenCalledOnce();
      expect(toast.success).toHaveBeenCalledWith("2 files uploaded.");
      expect(toast.error).not.toHaveBeenCalled();
   });

   it("retains one server's failure without calling its completion callback for another server's success", async () => {
      const firstComplete = vi.fn();
      const secondComplete = vi.fn();
      for (const [serverId, onComplete] of [
         ["first", firstComplete],
         ["second", secondComplete],
      ] as const) {
         useUploadStore.getState().enqueue({
            files: [file("backup.sql")],
            serverId,
            bucketName: "b",
            prefix: "p/",
            onComplete,
         });
      }
      await fail("backup.sql", "first");
      await finish("backup.sql", "second");
      expect(status("backup.sql", "first")).toBe("failed");
      expect(status("backup.sql", "second")).toBe("completed");
      expect(useUploadStore.getState().batch).toMatchObject({
         settled: true,
         completed: 1,
         failed: 1,
      });
      expect(firstComplete).not.toHaveBeenCalled();
      expect(secondComplete).toHaveBeenCalledOnce();
      expect(toast.error).toHaveBeenCalledWith(
         "1 of 2 files uploaded. 1 failed."
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
