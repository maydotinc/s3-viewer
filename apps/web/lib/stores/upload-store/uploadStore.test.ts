import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadCancelled } from "@/lib/utils/s3/upload-cancelled";

type Settle = { resolve: () => void; reject: (error: unknown) => void };
const inFlight = new Map<string, Settle>();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("@s3-viewer/ui/components/toast", () => ({ toast }));
vi.mock("@/lib/utils/s3/uploadObject", () => ({
   uploadObject: ({ objectKey }: { objectKey: string }) => {
      let settle: Settle | undefined;
      const done = new Promise<void>((resolve, reject) => {
         settle = { resolve, reject };
      });
      if (settle) inFlight.set(objectKey, settle);
      return {
         done,
         abort: () => inFlight.get(objectKey)?.reject(new UploadCancelled()),
      };
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
const status = (name: string) =>
   useUploadStore.getState().entries[`b/p/${name}`]?.status;
const finish = async (name: string) => {
   inFlight.get(`p/${name}`)?.resolve();
   await flush();
};
const fail = async (name: string) => {
   inFlight.get(`p/${name}`)?.reject(new Error("boom"));
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
      expect(["a", "b", "c"].map(status)).toEqual([
         "active",
         "active",
         "active",
      ]);
      expect(useUploadStore.getState().queue).toEqual(["b/p/d", "b/p/e"]);

      await finish("a");
      expect(status("d")).toBe("active");
      expect(useUploadStore.getState().batch).toMatchObject({
         completed: 1,
         failed: 0,
      });

      useUploadStore.getState().cancel("b/p/e");
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
         ids: ["b/p/a"],
      });
   });

   it("cancelAll aborts active uploads and drops queued ones in one pass", async () => {
      enqueue("a", "b", "c", "d");
      useUploadStore.getState().cancelAll();
      await flush();
      expect(["a", "b", "c", "d"].map(status)).toEqual([
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
});
