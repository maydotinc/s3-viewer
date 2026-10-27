import { beforeEach, describe, expect, it, vi } from "vitest";
import type { S3AbortUploadsResult, S3UploadRef } from "@s3-viewer/shared";

const h = vi.hoisted(() => ({
   remove: vi.fn(),
   success: vi.fn(),
   error: vi.fn(),
}));

vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: h.error },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { delete: h.remove },
}));

import { abortUploads } from "./useAbortMultipartUploads";

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
   it("sends only the reviewed pairs with the expected user", async () => {
      const listed = targets(2).map((target) => ({
         ...target,
         initiated: "2026-09-01T00:00:00.000Z",
         storageClass: "STANDARD",
      }));
      const summary = await abortUploads("/uploads", listed, "user1");
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
