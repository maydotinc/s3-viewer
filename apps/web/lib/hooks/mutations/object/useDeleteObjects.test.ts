import { describe, expect, it, vi } from "vitest";

const apiDelete = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
   const actual = await importOriginal<typeof import("@/lib/api")>();
   return {
      ...actual,
      api: { delete: (...args: unknown[]) => apiDelete(...args) },
      objectsPath: () => "/objects",
   };
});

vi.mock("@s3-viewer/types", async (importOriginal) => {
   const actual = await importOriginal<typeof import("@s3-viewer/types")>();
   return {
      ...actual,
      chunkKeys: (keys: readonly string[]) => keys.map((k) => [k]),
   };
});

vi.mock("@/lib/stores/sessionStore", () => ({
   default: (selector: (state: { serverId: string }) => unknown) =>
      selector({ serverId: "srv" }),
   useUserId: () => "user-1",
}));

const forgetKeys = vi.fn();
vi.mock("./invalidate", () => ({ forgetKeys }));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("@s3-viewer/ui/components/toast", () => ({ toast }));

type MutationConfig = {
   mutationFn: (params: {
      bucketName: string;
      objectKeys: string[];
      signal?: AbortSignal;
   }) => Promise<unknown>;
   onSuccess: (result: unknown) => void;
   onSettled: (result: unknown, error: unknown, params: unknown) => void;
};

let mutationConfig: MutationConfig | undefined;
vi.mock("@tanstack/react-query", () => ({
   useMutation: (config: MutationConfig) => {
      mutationConfig = config;
      return config;
   },
   useQueryClient: () => ({}),
}));

const { ApiError } = await import("@/lib/api");
const { default: useDeleteObjects } = await import("./useDeleteObjects");

describe("useDeleteObjects", () => {
   it("settles as cancelled, not success, once the signal is already aborted", async () => {
      apiDelete.mockReset();
      const controller = new AbortController();
      apiDelete.mockImplementationOnce(async () => {
         controller.abort();
         return { deleted: [{ key: "a" }], failed: [] };
      });

      useDeleteObjects();
      await expect(
         mutationConfig?.mutationFn({
            bucketName: "b",
            objectKeys: ["a", "b", "c"],
            signal: controller.signal,
         })
      ).rejects.toMatchObject({ code: "ABORTED" });

      expect(apiDelete).toHaveBeenCalledTimes(1);
   });

   it("settles as cancelled when a batch itself rejects with an abort", async () => {
      apiDelete.mockReset();
      apiDelete
         .mockImplementationOnce(async () => ({
            deleted: [{ key: "a" }],
            failed: [],
         }))
         .mockImplementationOnce(async () => {
            throw new ApiError(0, "Request cancelled", "ABORTED");
         });

      useDeleteObjects();
      await expect(
         mutationConfig?.mutationFn({
            bucketName: "b",
            objectKeys: ["a", "b", "c"],
         })
      ).rejects.toMatchObject({ code: "ABORTED" });

      expect(apiDelete).toHaveBeenCalledTimes(2);
   });

   it("reports nothing when a cancelled run never reaches onSuccess", () => {
      toast.success.mockClear();
      toast.error.mockClear();
      useDeleteObjects();
      mutationConfig?.onSettled(
         undefined,
         new ApiError(0, "Request cancelled", "ABORTED"),
         { bucketName: "b", objectKeys: ["a"] }
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
   });

   it("still throws, and reports nothing deleted, for a real (non-abort) failure", async () => {
      apiDelete.mockReset();
      apiDelete.mockImplementationOnce(async () => {
         throw new ApiError(500, "boom");
      });

      useDeleteObjects();
      await expect(
         mutationConfig?.mutationFn({ bucketName: "b", objectKeys: ["a"] })
      ).rejects.toThrow("boom");
   });

   it("invalidates the cache for a cancelled run via onSettled", () => {
      forgetKeys.mockClear();
      useDeleteObjects();
      mutationConfig?.onSettled(
         undefined,
         new ApiError(0, "Request cancelled", "ABORTED"),
         { bucketName: "b", objectKeys: ["a", "b", "c"] }
      );
      expect(forgetKeys).toHaveBeenCalledWith({}, "user-1", "srv", "b", [
         "a",
         "b",
         "c",
      ]);
   });
});
