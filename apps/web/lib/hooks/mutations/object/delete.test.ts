import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
   S3DeleteResult,
   S3DeleteTarget,
   S3KeysPage,
} from "@s3-viewer/types";

const h = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get, delete: h.remove },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));

import { deleteObjects } from "./useDeleteObjects";
import { deletePrefix } from "./useDeletePrefix";

const objects = (count: number): S3DeleteTarget[] =>
   Array.from({ length: count }, (_, index) => ({
      key: `folder/secret-${index}.txt`,
      expectedETag: `"reviewed-${index}"`,
   }));
const success = (
   _path: string,
   input: { objects: S3DeleteTarget[] }
): S3DeleteResult => ({
   deleted: input.objects.map(({ key }) => key),
   failed: [],
});

beforeEach(() => vi.clearAllMocks());

describe("delete retry snapshots", () => {
   it("retains all 150 failures and their original ETags for retry", async () => {
      const reviewed = objects(150);
      h.remove
         .mockImplementationOnce(
            async (_path, input: { objects: S3DeleteTarget[] }) =>
               ({
                  deleted: [],
                  failed: input.objects.map(({ key }) => ({
                     key,
                     message: "Access denied",
                     retryable: true,
                  })),
               }) satisfies S3DeleteResult
         )
         .mockImplementationOnce(success);
      const failed = await deleteObjects("/objects", reviewed, "user12345");
      expect(failed.failedTotal).toBe(150);
      expect(failed.failed).toHaveLength(150);
      const retried = await deleteObjects(
         "/objects",
         failed.failed,
         "user12345"
      );
      expect(retried).toMatchObject({ deleted: 150, failedTotal: 0 });
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([150, 150]);
      expect(h.remove.mock.calls[1]?.[1]).toMatchObject({
         objects: reviewed,
         expectedUserId: "user12345",
      });
   });

   it("retains uncertain requests for review without marking them retryable", async () => {
      const reviewed = objects(1150);
      h.remove
         .mockImplementationOnce(success)
         .mockRejectedValueOnce(new Error("Response lost"));
      const result = await deleteObjects("/objects", reviewed, "user12345");
      expect(result.deleted).toBe(1000);
      expect(result.failedTotal).toBe(150);
      expect(result.failed.every(({ retryable }) => retryable === false)).toBe(
         true
      );
      expect(
         result.failed.map(({ key, expectedETag }) => ({ key, expectedETag }))
      ).toEqual(reviewed.slice(1000));
   });

   it("permits missing ETags and refuses wildcard snapshots", async () => {
      h.remove.mockImplementation(success);
      const result = await deleteObjects(
         "/objects",
         [
            { key: "absent", expectedETag: null },
            { key: "wildcard", expectedETag: "*" },
         ],
         "user12345"
      );
      expect(result.failedTotal).toBe(1);
      expect(result.deleted).toBe(1);
      expect(h.remove).toHaveBeenCalledOnce();
   });

   it("treats unaccounted keys as failed even if the provider reports an empty success", async () => {
      h.remove.mockResolvedValue({ deleted: [], failed: [] });
      const result = await deleteObjects("/objects", objects(2), "user12345");
      expect(result).toMatchObject({ deleted: 0, failedTotal: 2 });
      expect(result.failed.every(({ retryable }) => retryable === false)).toBe(
         true
      );
   });

   it("retains a folder listing failure after earlier deletions without claiming completion", async () => {
      h.get
         .mockResolvedValueOnce({
            objects: objects(2),
            nextToken: "next",
         } satisfies S3KeysPage)
         .mockRejectedValueOnce(new Error("Listing failed"));
      h.remove.mockImplementation(success);
      const result = await deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
      });
      expect(result).toMatchObject({ deleted: 2, failedTotal: 0 });
      expect(result.listingError).toContain("Folder deletion is incomplete");
      expect(h.remove).toHaveBeenCalledTimes(1);
   });

   it("refuses a recursive listing that escapes the confirmed folder", async () => {
      h.get.mockResolvedValue({
         objects: [{ key: "elsewhere/private", expectedETag: '"private"' }],
         nextToken: null,
      } satisfies S3KeysPage);
      const result = await deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
      });
      expect(result.listingError).toContain("outside this folder");
      expect(h.remove).not.toHaveBeenCalled();
   });
});
