import { queryKeys } from "@/lib/query-keys";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
   useMutation: vi.fn(),
   useQueryClient: vi.fn(),
}));

const h = vi.hoisted(() => ({ uploadSingle: vi.fn() }));
vi.mock("@/lib/utils/s3/upload-object", () => ({
   uploadSingle: h.uploadSingle,
}));

import useSaveObjectContent, {
   cacheSavedContent,
} from "./useSaveObjectContent";

const client = {
   setQueryData: vi.fn(),
   invalidateQueries: vi.fn(),
   removeQueries: vi.fn(),
};

const input = {
   userId: "user1",
   serverId: "server1",
   bucketName: "bucket",
   objectKey: "notes/todo.md",
   contentType: "text/markdown",
   expectedETag: '"old"',
   text: "# saved\r\n",
};

const save = () =>
   cacheSavedContent(client as unknown as QueryClient, input, {
      key: input.objectKey,
      size: 9,
      eTag: '"new"',
   });

const invalidated = () =>
   client.invalidateQueries.mock.calls.map(([{ queryKey }]) => queryKey);

beforeEach(() => vi.clearAllMocks());

describe("what a save does to the cache", () => {
   it("replaces the content in place instead of dropping it", () => {
      save();
      expect(client.removeQueries).not.toHaveBeenCalled();
      expect(client.setQueryData).toHaveBeenCalledWith(
         queryKeys.objectContent("user1", "server1", "bucket", "notes/todo.md"),
         { text: "# saved\r\n", eTag: '"new"' }
      );
   });

   it("refetches everything else the object feeds", () => {
      save();
      expect(invalidated()).toEqual([
         queryKeys.objectPreview("user1", "server1", "bucket", "notes/todo.md"),
         queryKeys.objectSettings(
            "user1",
            "server1",
            "bucket",
            "notes/todo.md"
         ),
         queryKeys.bucketSuggestions("user1", "server1", "bucket"),
      ]);
   });
});

describe("sending a save", () => {
   it("uploads the text through the single-object upload path", async () => {
      vi.mocked(useMutation).mockImplementation((options) => options as never);
      const { mutationFn } = useSaveObjectContent() as unknown as {
         mutationFn: (value: typeof input) => Promise<unknown>;
      };
      const stored = { key: input.objectKey, size: 9, eTag: '"new"' };
      h.uploadSingle.mockReturnValue({
         done: Promise.resolve(stored),
         abort: vi.fn(),
      });
      await expect(mutationFn(input)).resolves.toEqual(stored);
      const [params] = h.uploadSingle.mock.calls[0]!;
      expect(params.file.type).toBe("text/markdown");
      await expect(params.file.text()).resolves.toBe("# saved\r\n");
   });
});
