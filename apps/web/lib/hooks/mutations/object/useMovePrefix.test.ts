import { beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({
   api: h,
   objectsPath: () => "/objects",
   qs: (input: { continuationToken?: string }) =>
      input.continuationToken ? `?token=${input.continuationToken}` : "",
   cancelledError: () => new Error("cancelled"),
   errorMessage: (error: Error) => error.message,
   isAborted: () => false,
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-query", () => ({
   useMutation: vi.fn(),
   useQueryClient: vi.fn(),
}));
const { movePrefix } = await import("./useMovePrefix");
const input = {
   userId: "user",
   serverId: "server",
   bucketName: "bucket",
   prefix: "raw/deep/",
   newPrefix: "archive/",
};
beforeEach(() => vi.resetAllMocks());

it.each(["raw/", "raw/deep/", "raw/deep/deeper/", ""])(
   "rejects overlapping prefix %s before a live multipage listing can process its output",
   async (newPrefix) => {
      h.get.mockResolvedValue({
         objects: Array.from({ length: 1000 }, (_, n) => ({
            key: `raw/deep/deep/item-${n}`,
            expectedETag: "etag",
         })),
         nextToken: "next",
      });
      await expect(movePrefix({ ...input, newPrefix })).rejects.toThrow(
         "must not overlap"
      );
      expect(h.get).not.toHaveBeenCalled();
      expect(h.post).not.toHaveBeenCalled();
   }
);

it("moves each of 1,001 original keys exactly once between disjoint prefixes", async () => {
   const objects = Array.from({ length: 1001 }, (_, n) => ({
      key: `raw/deep/deep/item-${n}`,
      expectedETag: `etag-${n}`,
   }));
   h.get
      .mockResolvedValueOnce({
         objects: objects.slice(0, 1000),
         nextToken: "next",
      })
      .mockResolvedValueOnce({ objects: objects.slice(1000), nextToken: null });
   h.post.mockImplementation(async (_path, body) => ({
      moved: body.objects.map(({ key }: { key: string }) => key),
      failed: [],
   }));
   const result = await movePrefix(input);
   expect(result).toMatchObject({ done: 1001, failed: [], remaining: false });
   const sent = h.post.mock.calls.flatMap(([, body]) => body.objects);
   expect(sent).toHaveLength(1001);
   expect(new Set(sent.map(({ key }) => key)).size).toBe(1001);
   expect(
      sent.every(
         ({ key, newKey }) =>
            newKey === `archive/${key.slice(input.prefix.length)}`
      )
   ).toBe(true);
});

it("stops with a readable listing error when a listed key has no valid destination", async () => {
   h.get.mockResolvedValueOnce({
      objects: [
         { key: "raw/deep/ok", expectedETag: "etag-1" },
         { key: "raw/deep//empty-segment", expectedETag: "etag-2" },
      ],
      nextToken: "next",
   });
   const result = await movePrefix(input);
   expect(h.post).not.toHaveBeenCalled();
   expect(h.get).toHaveBeenCalledTimes(1);
   expect(result).toMatchObject({ done: 0, remaining: true });
   expect(result.listingError).toBe(
      "Can't move raw/deep//empty-segment: its new key must be valid and at most 1,024 UTF-8 bytes. The folder move is incomplete."
   );
});
