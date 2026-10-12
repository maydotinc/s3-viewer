import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BATCH_KEYS } from "@s3-viewer/types";
const h = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", () => ({
   api: { post: h.post },
   objectsPath: (serverId: string, bucket: string) =>
      `/servers/${serverId}/buckets/${bucket}/objects`,
   cancelledError: () => new Error("cancelled"),
}));
import { checkUploadConflicts } from "./upload-preflight";

const check = (keys: string[], controller = new AbortController()) =>
   checkUploadConflicts({
      serverId: "server-a",
      bucketName: "backups",
      keys,
      signal: controller.signal,
   });

beforeEach(() => h.post.mockReset());

describe("upload replacement preflight", () => {
   it("collects the original full-key ETags across response pages without granting replacement for new files", async () => {
      const keys = Array.from(
         { length: MAX_BATCH_KEYS + 1 },
         (_, i) => `folder/file-${i}`
      );
      const last = keys[keys.length - 1]!;
      h.post.mockResolvedValueOnce({
         existing: [keys[0]],
         eTags: {
            [keys[0]!]: '"first-version"',
            [keys[1]!]: '"unrequested-replacement"',
         },
      });
      h.post.mockResolvedValueOnce({
         existing: [last],
         eTags: { [last]: '"last-version"' },
      });
      const result = await check(keys);
      expect(h.post).toHaveBeenCalledTimes(2);
      expect(result.existing).toEqual([keys[0], last]);
      expect(result.eTags).toEqual({
         [keys[0]!]: '"first-version"',
         [last]: '"last-version"',
      });
      expect(Object.hasOwn(result.eTags, keys[1]!)).toBe(false);
   });

   it.each([{ existing: [] }, { existing: ["folder/unknown"] }])(
      "refuses old APIs even when no collisions were found (%j)",
      async ({ existing }) => {
         h.post.mockResolvedValue({ existing });
         await expect(check(["folder/unknown"])).rejects.toThrow(
            "Update the API"
         );
      }
   );

   it.each([{}, { "folder/unknown": "" }])(
      "refuses unresolved/existing objects without a recorded ETag (%j)",
      async (eTags) => {
         h.post.mockResolvedValue({ existing: ["folder/unknown"], eTags });
         await expect(check(["folder/unknown"])).rejects.toThrow(
            "Upload fewer files"
         );
      }
   );

   it("does not accept inherited ETags", async () => {
      h.post.mockResolvedValue({ existing: ["constructor"], eTags: {} });
      await expect(check(["constructor"])).rejects.toThrow(
         "Upload fewer files"
      );
   });

   it("preserves special object names without modifying the map's prototype", async () => {
      h.post.mockResolvedValue({
         existing: ["__proto__"],
         eTags: Object.fromEntries([["__proto__", '"version"']]),
      });
      const result = await check(["__proto__"]);
      expect(Object.getPrototypeOf(result.eTags)).toBeNull();
      expect(result.eTags["__proto__"]).toBe('"version"');
   });

   it("discards a response that arrives after cancellation", async () => {
      const controller = new AbortController();
      h.post.mockImplementation(async () => {
         controller.abort();
         return { existing: [], eTags: {} };
      });
      await expect(check(["new.txt"], controller)).rejects.toThrow("cancelled");
   });
});
