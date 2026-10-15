import { MAX_BULK_RENAME_KEYS } from "@/lib/utils/s3/bulk-rename";
import type { S3KeysPage } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get, post: h.post },
}));

import { collectSources, findExisting } from "./plan";

const target = (key: string): S3KeysPage["objects"][number] => ({
   key,
   size: null,
   expectedETag: `"${key}"`,
});

const page = (keys: string[], nextToken: string | null): S3KeysPage => ({
   objects: keys.map(target),
   nextToken,
});

beforeEach(() => {
   h.get.mockReset();
   h.post.mockReset();
   h.post.mockResolvedValue({ existing: [], eTags: {} });
});

describe("collectSources", () => {
   it("keeps a plain selection as it is", async () => {
      const targets = [target("a/one.txt"), target("a/two.txt")];
      const snapshot = await collectSources({ path: "/objects", targets });
      expect(snapshot).toEqual({ objects: targets, truncated: false });
      expect(h.get).not.toHaveBeenCalled();
   });

   it("expands a folder through every listing page, without the markers", async () => {
      h.get
         .mockResolvedValueOnce(page(["a/", "a/one.txt"], "next"))
         .mockResolvedValueOnce(page(["a/sub/", "a/sub/two.txt"], null));
      const snapshot = await collectSources({
         path: "/objects",
         targets: [target("a/")],
      });
      expect(snapshot.objects.map(({ key }) => key)).toEqual([
         "a/one.txt",
         "a/sub/two.txt",
      ]);
      expect(h.get).toHaveBeenCalledTimes(2);
   });

   it("expands the folders inside a mixed selection", async () => {
      h.get.mockResolvedValue(page(["a/one.txt"], null));
      const snapshot = await collectSources({
         path: "/objects",
         targets: [target("root.txt"), target("a/")],
      });
      expect(snapshot.objects.map(({ key }) => key)).toEqual([
         "root.txt",
         "a/one.txt",
      ]);
   });

   it("keeps one entry per key when a folder repeats a selected file", async () => {
      h.get.mockResolvedValue(page(["a/one.txt"], null));
      const snapshot = await collectSources({
         path: "/objects",
         targets: [target("a/one.txt"), target("a/")],
      });
      expect(snapshot.objects).toHaveLength(1);
   });

   it("reports progress as the folder is listed", async () => {
      h.get
         .mockResolvedValueOnce(page(["a/one.txt"], "next"))
         .mockResolvedValueOnce(page(["a/two.txt"], null));
      const seen: number[] = [];
      await collectSources({
         path: "/objects",
         targets: [target("a/")],
         onProgress: (listed) => seen.push(listed),
      });
      expect(seen).toEqual([1, 2, 2]);
   });

   it("stops and flags a folder larger than one dialog can review", async () => {
      const many = Array.from(
         { length: MAX_BULK_RENAME_KEYS + 10 },
         (_unused, index) => `a/file-${index}.txt`
      );
      h.get.mockResolvedValue(page(many, null));
      const snapshot = await collectSources({
         path: "/objects",
         targets: [target("a/")],
      });
      expect(snapshot.truncated).toBe(true);
      expect(snapshot.objects).toHaveLength(MAX_BULK_RENAME_KEYS);
   });
});

describe("findExisting", () => {
   it("returns only the keys storage says are there", async () => {
      h.post.mockResolvedValue({
         existing: ["a/one.txt", "not-asked.txt"],
         eTags: {},
      });
      const found = await findExisting("/objects", ["a/one.txt", "a/two.txt"]);
      expect(found).toEqual(["a/one.txt"]);
      expect(h.post).toHaveBeenCalledWith(
         "/objects/exists",
         { objectKeys: ["a/one.txt", "a/two.txt"] },
         undefined
      );
   });

   it("chunks past the batch limit and asks each key once", async () => {
      const keys = Array.from(
         { length: 1500 },
         (_unused, index) => `a/file-${index}.txt`
      );
      await findExisting("/objects", [...keys, ...keys]);
      expect(
         h.post.mock.calls.map(([, body]) => body.objectKeys.length)
      ).toEqual([1000, 500]);
   });

   it("stops before the next batch once cancelled", async () => {
      const controller = new AbortController();
      const keys = Array.from(
         { length: 1500 },
         (_unused, index) => `a/file-${index}.txt`
      );
      h.post.mockImplementation(async () => {
         controller.abort();
         return { existing: [], eTags: {} };
      });
      await expect(
         findExisting("/objects", keys, controller.signal)
      ).rejects.toThrow("Request cancelled");
      expect(h.post).toHaveBeenCalledOnce();
   });
});
