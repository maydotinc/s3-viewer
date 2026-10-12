import type { S3KeysPage } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));

import { isAborted } from "@/lib/api";
import { walkPrefix } from "./walk-prefix";

const page = (keys: string[], nextToken: string | null = null): S3KeysPage =>
   ({
      objects: keys.map((key) => ({ key, expectedETag: null })),
      nextToken,
   }) as unknown as S3KeysPage;

const walked = async (signal?: AbortSignal): Promise<string[][]> => {
   const seen: string[][] = [];
   for await (const listed of walkPrefix("/objects", "photos/", signal))
      seen.push(listed.objects.map(({ key }) => key));
   return seen;
};

beforeEach(() => {
   h.get.mockReset();
});

describe("walking a folder", () => {
   it("follows the continuation token to the last page", async () => {
      h.get
         .mockResolvedValueOnce(page(["photos/a.jpg"], "t1"))
         .mockResolvedValueOnce(page(["photos/b.jpg"]));
      expect(await walked()).toEqual([["photos/a.jpg"], ["photos/b.jpg"]]);
      expect(h.get.mock.calls.map(([path]) => path)).toEqual([
         "/objects/keys?prefix=photos%2F",
         "/objects/keys?prefix=photos%2F&continuationToken=t1",
      ]);
   });

   it("stops rather than loop when storage repeats a page", async () => {
      h.get
         .mockResolvedValueOnce(page(["photos/a.jpg"], "t1"))
         .mockResolvedValueOnce(page(["photos/b.jpg"], "t1"));
      await expect(walked()).rejects.toThrow(
         "Storage repeated a folder listing page."
      );
   });

   it("refuses a page holding a key from outside the folder", async () => {
      h.get.mockResolvedValue(page(["photos/a.jpg", "invoices/b.pdf"]));
      await expect(walked()).rejects.toThrow(
         "Storage returned an object outside this folder."
      );
   });

   it("asks for nothing once the caller has given up", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(walked(controller.signal)).rejects.toSatisfy(isAborted);
      expect(h.get).not.toHaveBeenCalled();
   });
});
