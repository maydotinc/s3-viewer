import { beforeEach, describe, expect, it, vi } from "vitest";
import type { S3MoveResult } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   post: vi.fn(),
   success: vi.fn(),
   error: vi.fn(),
}));

vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: h.error },
}));
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      removeQueries: vi.fn(),
   }),
   useMutation: (options: unknown) => options,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { post: h.post },
}));

import { moveObjects, type MoveTarget } from "./useMoveObjects";

type MoveBody = { objects: MoveTarget[] };

const allMoved = async (
   _path: string,
   body: MoveBody
): Promise<S3MoveResult> => ({
   moved: body.objects.map(({ key }) => key),
   failed: [],
});

const target = (key: string, newKey: string): MoveTarget => ({
   key,
   newKey,
   expectedETag: null,
});

beforeEach(() => {
   vi.clearAllMocks();
   h.post.mockReset();
   h.post.mockImplementation(allMoved);
});

describe("moveObjects", () => {
   it("keeps two moves whose keys concatenate to the same string apart", async () => {
      const objects = [target("a", "bc"), target("ab", "c")];
      const summary = await moveObjects("/objects", objects, "user1");

      expect((h.post.mock.calls[0]?.[1] as MoveBody).objects).toEqual(objects);
      expect(summary.done).toBe(2);
      expect(summary.failed).toEqual([]);
   });

   it("still sends a repeated pair only once", async () => {
      const objects = [target("a", "b"), target("a", "b")];
      const summary = await moveObjects("/objects", objects, "user1");

      expect((h.post.mock.calls[0]?.[1] as MoveBody).objects).toHaveLength(1);
      expect(summary.done).toBe(1);
   });

   it.each(["dest//b", "dest/../b", `dest/${"x".repeat(1100)}`])(
      "refuses the invalid new key %#, naming the source, before sending anything",
      async (newKey) => {
         const failure = moveObjects(
            "/objects",
            [target("a", "dest/a"), target("src/b", newKey)],
            "user1"
         );

         await expect(failure).rejects.toThrow(
            "Can't move src/b: its new key must be valid and at most 1,024 UTF-8 bytes."
         );
         expect(h.post).not.toHaveBeenCalled();
      }
   );

   it("spells out bidi characters in the source key it names", async () => {
      await expect(
         moveObjects("/objects", [target("a\u202Eb", "dest//b")], "user1")
      ).rejects.toThrow("Can't move a[U+202E]b: its new key must be valid");
   });
});
