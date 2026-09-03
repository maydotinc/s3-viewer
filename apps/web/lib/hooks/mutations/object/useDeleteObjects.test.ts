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
   onSuccess: (result: unknown, params: unknown) => void;
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
   it("stops before starting the next batch once the signal is already aborted", async () => {
      apiDelete.mockReset();
      const controller = new AbortController();
      apiDelete.mockImplementationOnce(async () => {
         controller.abort();
         return { deleted: [{ key: "a" }], failed: [] };
      });

      useDeleteObjects();
      const summary = await mutationConfig?.mutationFn({
         bucketName: "b",
         objectKeys: ["a", "b", "c"],
         signal: controller.signal,
      });

      expect(apiDelete).toHaveBeenCalledTimes(1);
      expect(summary).toEqual({ deleted: 1, failedTotal: 0, failed: [] });
   });

   it("keeps the partial summary and doesn't throw when a batch rejects with an abort", async () => {
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
      const summary = await mutationConfig?.mutationFn({
         bucketName: "b",
         objectKeys: ["a", "b", "c"],
      });

      expect(apiDelete).toHaveBeenCalledTimes(2);
      expect(summary).toEqual({ deleted: 1, failedTotal: 0, failed: [] });
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

   it("invalidates the cache for a partial (aborted) result via onSuccess", () => {
      forgetKeys.mockClear();
      useDeleteObjects();
      mutationConfig?.onSuccess(
         { deleted: 1, failedTotal: 0, failed: [] },
         { bucketName: "b", objectKeys: ["a", "b", "c"] }
      );
      expect(forgetKeys).toHaveBeenCalledWith({}, "user-1", "srv", "b", [
         "a",
         "b",
         "c",
      ]);
   });
});
