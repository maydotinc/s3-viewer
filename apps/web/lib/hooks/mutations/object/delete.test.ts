import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
afterEach(() => vi.useRealTimers());

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
      expect(failed.failed).toHaveLength(150);
      const retried = await deleteObjects(
         "/objects",
         failed.failed,
         "user12345"
      );
      expect(retried).toMatchObject({ done: 150, failed: [] });
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
      expect(result.done).toBe(1000);
      expect(result.failed).toHaveLength(150);
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
      expect(result.failed).toHaveLength(1);
      expect(result.done).toBe(1);
      expect(h.remove).toHaveBeenCalledOnce();
   });

   it("treats unaccounted keys as failed even if the provider reports an empty success", async () => {
      h.remove.mockResolvedValue({ deleted: [], failed: [] });
      const result = await deleteObjects("/objects", objects(2), "user12345");
      expect(result.done).toBe(0);
      expect(result.failed).toHaveLength(2);
      expect(result.failed.every(({ retryable }) => retryable === false)).toBe(
         true
      );
   });

   it("retains a folder listing failure after earlier deletions without claiming completion", async () => {
      h.get
         .mockResolvedValueOnce({
            objects: objects(2).map((object) => ({ ...object, size: null })),
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
      expect(result).toMatchObject({ done: 2, failed: [] });
      expect(result.listingError).toContain("Folder deletion is incomplete");
      expect(h.remove).toHaveBeenCalledTimes(1);
   });

   it("stops at the first failing batch and reports the work left behind", async () => {
      h.get.mockResolvedValueOnce({
         objects: objects(2).map((object) => ({ ...object, size: null })),
         nextToken: "next",
      } satisfies S3KeysPage);
      h.remove.mockResolvedValueOnce({
         deleted: [],
         failed: [
            {
               key: "folder/secret-0.txt",
               message: "Access denied",
               retryable: true,
            },
         ],
      } satisfies S3DeleteResult);
      const result = await deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
      });
      expect(result).toMatchObject({ done: 0, remaining: true });
      expect(result.failed).toHaveLength(2);
      expect(h.get).toHaveBeenCalledOnce();
      expect(h.remove).toHaveBeenCalledOnce();
   });

   it("still reports work remaining when the last page is the one that keeps failing", async () => {
      vi.useFakeTimers();
      const refused = {
         deleted: [],
         failed: [
            {
               key: "folder/secret-0.txt",
               message: "Too many storage requests.",
               retryable: true,
               refused: true,
            },
         ],
      } satisfies S3DeleteResult;
      h.get.mockResolvedValueOnce({
         objects: objects(2).map((object) => ({ ...object, size: null })),
         nextToken: null,
      } satisfies S3KeysPage);
      h.remove
         .mockReset()
         .mockResolvedValueOnce({
            ...refused,
            deleted: ["folder/secret-1.txt"],
         } satisfies S3DeleteResult)
         .mockResolvedValue(refused);
      const pending = deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
      });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result).toMatchObject({ done: 1, remaining: true });
      expect(result.failed).toHaveLength(1);
      expect(
         h.remove.mock.calls.map(([, input]) =>
            input.objects.map(({ key }: S3DeleteTarget) => key)
         )
      ).toEqual([
         ["folder/secret-0.txt", "folder/secret-1.txt"],
         ...Array.from({ length: 5 }, () => ["folder/secret-0.txt"]),
      ]);
   });

   it("waits out a page of retryable refusals and carries on without a manual resume", async () => {
      vi.useFakeTimers();
      const listed = objects(4).map((object) => ({ ...object, size: null }));
      h.get
         .mockResolvedValueOnce({
            objects: listed.slice(0, 2),
            nextToken: "next",
         } satisfies S3KeysPage)
         .mockResolvedValueOnce({
            objects: listed.slice(2),
            nextToken: null,
         } satisfies S3KeysPage);
      h.remove
         .mockReset()
         .mockImplementationOnce(async (path, input) => success(path, input))
         .mockResolvedValueOnce({
            deleted: ["folder/secret-2.txt"],
            failed: [
               {
                  key: "folder/secret-3.txt",
                  message: "Too many storage requests.",
                  retryable: true,
                  refused: true,
               },
            ],
         } satisfies S3DeleteResult)
         .mockImplementation(async (path, input) => success(path, input));
      const onProgress = vi.fn();
      const pending = deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
         onProgress,
      });
      await vi.advanceTimersByTimeAsync(1999);
      expect(h.remove).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenLastCalledWith(3);
      await vi.advanceTimersByTimeAsync(1);
      const result = await pending;
      expect(h.remove).toHaveBeenCalledTimes(3);
      expect(h.remove.mock.calls[2]?.[1].objects).toEqual([
         { key: "folder/secret-3.txt", expectedETag: '"reviewed-3"' },
      ]);
      expect(result).toEqual({
         done: 4,
         failed: [],
         unsent: [],
         listingError: null,
         remaining: false,
         aborted: false,
      });
   });

   it("stops waiting the moment the deletion is cancelled", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      h.get.mockResolvedValueOnce({
         objects: objects(2).map((object) => ({ ...object, size: null })),
         nextToken: null,
      } satisfies S3KeysPage);
      h.remove.mockReset().mockResolvedValue({
         deleted: ["folder/secret-1.txt"],
         failed: [
            {
               key: "folder/secret-0.txt",
               message: "Too many storage requests.",
               retryable: true,
               refused: true,
            },
         ],
      } satisfies S3DeleteResult);
      const pending = deletePrefix({
         userId: "user12345",
         serverId: "server123",
         bucketName: "bucket",
         prefix: "folder/",
         signal: controller.signal,
      });
      await vi.advanceTimersByTimeAsync(100);
      controller.abort();
      await expect(pending).resolves.toMatchObject({
         done: 1,
         aborted: true,
         remaining: true,
      });
      expect(h.remove).toHaveBeenCalledOnce();
   });

   it("refuses a recursive listing that escapes the confirmed folder", async () => {
      h.get.mockResolvedValue({
         objects: [
            { key: "elsewhere/private", expectedETag: '"private"', size: null },
         ],
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
