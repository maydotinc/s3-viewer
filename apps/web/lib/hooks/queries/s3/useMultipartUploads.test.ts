import { multipartUploadsPath } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { S3MultipartUploadPage } from "@s3-viewer/types";
import type { UploadsMarker } from "./useMultipartUploads";

type Options = {
   queryKey: readonly unknown[];
   queryFn: (context: {
      pageParam: UploadsMarker | null;
      signal: AbortSignal;
   }) => Promise<unknown>;
   getNextPageParam: (page: S3MultipartUploadPage) => UploadsMarker | null;
   enabled: boolean;
};

const h = vi.hoisted(() => ({
   get: vi.fn(),
   options: null as unknown,
   result: { data: undefined } as Record<string, unknown>,
   userId: "user1",
}));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => h.userId }));
vi.mock("@tanstack/react-query", () => ({
   useInfiniteQuery: (options: unknown) => {
      h.options = options;
      return h.result;
   },
}));
vi.mock("react", async (original) => ({
   ...(await original<typeof import("react")>()),
   useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get },
}));

import useMultipartUploads from "./useMultipartUploads";

const signal = new AbortController().signal;

const upload = (key: string) => ({
   key,
   uploadId: `${key}-id`,
   initiated: "2026-09-01T00:00:00.000Z",
   storageClass: "STANDARD",
});

const page = (
   keys: string[],
   nextKeyMarker: string | null
): S3MultipartUploadPage => ({
   uploads: keys.map(upload),
   nextKeyMarker,
   nextUploadIdMarker: nextKeyMarker ? "u9" : null,
});

const useOptions = (prefix = "photos/", enabled = true): Options => {
   useMultipartUploads("server1", "bucket", prefix, enabled);
   return h.options as Options;
};

beforeEach(() => {
   h.options = null;
   h.result = { data: undefined };
   h.userId = "user1";
   h.get.mockReset();
   h.get.mockResolvedValue(page(["photos/a.bin"], null));
});

describe("multipart upload listing", () => {
   it("asks for the current prefix with no markers", async () => {
      await useOptions().queryFn({ pageParam: null, signal });
      expect(h.get).toHaveBeenCalledWith(
         "/servers/server1/buckets/bucket/objects/v3/multipart-uploads?prefix=photos%2F",
         signal
      );
   });

   it("carries both markers into the next page", async () => {
      const next = useOptions().getNextPageParam(page(["a"], "photos/b.bin"));
      expect(next).toEqual({
         keyMarker: "photos/b.bin",
         uploadIdMarker: "u9",
      });
      await useOptions().queryFn({ pageParam: next!, signal });
      const url = h.get.mock.calls[0]?.[0] as string;
      expect(url).toContain("keyMarker=photos%2Fb.bin");
      expect(url).toContain("uploadIdMarker=u9");
   });

   it("passes a folder marker back untouched, with no upload id", async () => {
      const marker = "landing/a b,c/";
      const next = useOptions("").getNextPageParam({
         uploads: [],
         nextKeyMarker: marker,
         nextUploadIdMarker: null,
      });
      expect(next).toEqual({ keyMarker: marker, uploadIdMarker: null });
      await useOptions("").queryFn({ pageParam: next!, signal });
      const query = new URL(h.get.mock.calls[0]?.[0] as string, "http://x")
         .searchParams;
      expect(query.get("keyMarker")).toBe(marker);
      expect(query.has("uploadIdMarker")).toBe(false);
   });

   it("keeps paging past a page with no uploads in it", () => {
      expect(
         useOptions().getNextPageParam({
            uploads: [],
            nextKeyMarker: "zeta/",
            nextUploadIdMarker: null,
         })
      ).toEqual({ keyMarker: "zeta/", uploadIdMarker: null });
   });

   it("stops paging when storage reports no next key", () => {
      expect(useOptions().getNextPageParam(page(["a"], null))).toBeNull();
   });

   it("stays disabled without a signed-in user or when the dialog is closed", () => {
      h.userId = "";
      expect(useOptions().enabled).toBe(false);
      h.userId = "user1";
      expect(useOptions("photos/", false).enabled).toBe(false);
      expect(useOptions().enabled).toBe(true);
   });

   it("scopes the cache by bucket and prefix", () => {
      expect(useOptions("photos/").queryKey).toEqual([
         ...queryKeys.multipartUploads("user1", "server1", "bucket"),
         "photos/",
      ]);
      expect(useOptions("other/").queryKey).not.toEqual(
         useOptions("photos/").queryKey
      );
   });

   it("flattens every loaded page into one list", () => {
      h.result = {
         data: { pages: [page(["a"], "b"), page(["b"], null)] },
         hasNextPage: false,
      };
      const { uploads } = useMultipartUploads("server1", "bucket", "", true);
      expect(uploads.map(({ key }) => key)).toEqual(["a", "b"]);
   });

   it("targets the versioned route", () => {
      expect(multipartUploadsPath("server1", "my bucket")).toBe(
         "/servers/server1/buckets/my%20bucket/objects/v3/multipart-uploads"
      );
   });
});
