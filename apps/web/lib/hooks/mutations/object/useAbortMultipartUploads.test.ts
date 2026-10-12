import { beforeEach, describe, expect, it, vi } from "vitest";
import type { S3AbortUploadsResult, S3UploadRef } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   remove: vi.fn(),
   success: vi.fn(),
   error: vi.fn(),
}));

vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: h.error },
}));
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => ({ invalidateQueries: vi.fn() }),
   useMutation: (options: unknown) => options,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { delete: h.remove },
}));

import { abortUploads, reportAbortResult } from "./useAbortMultipartUploads";

const targets = (count: number): S3UploadRef[] =>
   Array.from({ length: count }, (_unused, index) => ({
      key: `photos/part-${index}.bin`,
      uploadId: `upload-${index}`,
   }));

const allAborted = async (
   _path: string,
   body: { uploads: S3UploadRef[] }
): Promise<S3AbortUploadsResult> => ({ aborted: body.uploads, failed: [] });

beforeEach(() => {
   vi.clearAllMocks();
   h.remove.mockReset();
   h.remove.mockImplementation(allAborted);
});

describe("abortUploads", () => {
   it("sends the reviewed pairs with the expected user", async () => {
      const summary = await abortUploads("/uploads", targets(2), "user1");
      expect(h.remove).toHaveBeenCalledWith(
         "/uploads",
         {
            expectedUserId: "user1",
            uploads: [
               { key: "photos/part-0.bin", uploadId: "upload-0" },
               { key: "photos/part-1.bin", uploadId: "upload-1" },
            ],
         },
         undefined
      );
      expect(summary).toEqual({ aborted: 2, failed: [], cancelled: false });
   });

   it("sends at most a hundred uploads per request", async () => {
      const summary = await abortUploads("/uploads", targets(250), "user1");
      expect(
         h.remove.mock.calls.map(([, body]) => body.uploads.length)
      ).toEqual([100, 100, 50]);
      expect(summary.aborted).toBe(250);
   });

   it("keeps per-row failures with the storage message", async () => {
      h.remove.mockReset().mockResolvedValue({
         aborted: [{ key: "photos/part-0.bin", uploadId: "upload-0" }],
         failed: [
            {
               key: "photos/part-1.bin",
               uploadId: "upload-1",
               message: "Access denied",
            },
         ],
      } satisfies S3AbortUploadsResult);
      const summary = await abortUploads("/uploads", targets(2), "user1");
      expect(summary.aborted).toBe(1);
      expect(summary.failed).toEqual([
         {
            key: "photos/part-1.bin",
            uploadId: "upload-1",
            message: "Access denied",
         },
      ]);
   });

   it("never counts an upload storage did not mention", async () => {
      h.remove.mockReset().mockResolvedValue({ aborted: [], failed: [] });
      const summary = await abortUploads("/uploads", targets(1), "user1");
      expect(summary.aborted).toBe(0);
      expect(summary.failed[0]?.message).toBe(
         "Storage did not confirm the abort. Refresh and check this upload."
      );
   });

   it("does not confuse two uploads of the same key", async () => {
      const pair = [
         { key: "photos/a.bin", uploadId: "one" },
         { key: "photos/a.bin", uploadId: "two" },
      ];
      h.remove.mockReset().mockResolvedValue({
         aborted: [pair[0]],
         failed: [{ ...pair[1], message: "Gone" }],
      } as S3AbortUploadsResult);
      const summary = await abortUploads("/uploads", pair, "user1");
      expect(summary.aborted).toBe(1);
      expect(summary.failed).toEqual([{ ...pair[1], message: "Gone" }]);
   });

   it("turns a failed request into failures instead of losing the batch", async () => {
      h.remove.mockReset().mockRejectedValue(new Error("Response lost"));
      const summary = await abortUploads("/uploads", targets(2), "user1");
      expect(summary.aborted).toBe(0);
      expect(summary.failed.map(({ message }) => message)).toEqual([
         "Response lost",
         "Response lost",
      ]);
   });

   it("stops before the next batch once cancelled", async () => {
      const controller = new AbortController();
      h.remove.mockReset().mockImplementation(async (path, body) => {
         controller.abort();
         return allAborted(path, body);
      });
      await expect(
         abortUploads("/uploads", targets(1500), "user1", controller.signal)
      ).resolves.toEqual({ aborted: 100, failed: [], cancelled: true });
      expect(h.remove).toHaveBeenCalledOnce();
   });
});

describe("reportAbortResult", () => {
   it("stays silent when nothing was aborted", () => {
      reportAbortResult({ aborted: 0, failed: [], cancelled: false });
      expect(h.success).not.toHaveBeenCalled();
      expect(h.error).not.toHaveBeenCalled();
   });

   it("counts the aborted uploads", () => {
      reportAbortResult({ aborted: 1, failed: [], cancelled: false });
      expect(h.success).toHaveBeenCalledWith("1 incomplete upload aborted.");
      reportAbortResult({ aborted: 4, failed: [], cancelled: false });
      expect(h.success).toHaveBeenCalledWith("4 incomplete uploads aborted.");
   });

   it("names the first failures and totals the rest", () => {
      reportAbortResult({
         aborted: 1,
         failed: targets(5).map((target) => ({ ...target, message: "no" })),
         cancelled: false,
      });
      expect(h.error).toHaveBeenCalledWith(
         "Some uploads could not be aborted",
         {
            description:
               "1 aborted, 5 failed: photos/part-0.bin, photos/part-1.bin, photos/part-2.bin and 2 more.",
         }
      );
   });
});
