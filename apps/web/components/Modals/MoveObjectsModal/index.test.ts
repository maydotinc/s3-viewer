import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { S3MoveResult } from "@s3-viewer/types";
import { one } from "@/lib/test/elements";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import FailureList from "@/components/Modals/failure-list";

type MoveBody = { objects: { key: string; newKey: string }[] };

const h = vi.hoisted(() => ({
   slots: [] as unknown[],
   cursor: 0,
   get: vi.fn(),
   post: vi.fn(),
   pending: [] as Promise<unknown>[],
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [
         h.slots[index],
         (value: unknown) => {
            h.slots[index] =
               typeof value === "function"
                  ? (value as (previous: unknown) => unknown)(h.slots[index])
                  : value;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      return (h.slots[index] ??= { current });
   },
   useEffect: () => undefined,
}));
vi.mock("@/lib/hooks/useBeforeUnload", () => ({ useBeforeUnload: vi.fn() }));
vi.mock("@/lib/hooks/useAbortableTask", () => ({
   useAbortableTask: () => ({
      start: () => new AbortController().signal,
      ifMounted: (run: () => void) => run(),
      cancel: vi.fn(),
   }),
}));
vi.mock("@/components/Modals/key-dialog", () => ({ KeyDialog: () => null }));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({ servers: [] }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => ({}),
   useMutation: (options: {
      mutationFn: (input: unknown) => Promise<unknown>;
   }) => ({
      isPending: false,
      mutate: (
         input: unknown,
         callbacks: { onSuccess: (result: unknown) => void }
      ) => {
         h.pending.push(options.mutationFn(input).then(callbacks.onSuccess));
      },
   }),
}));
vi.mock("@/lib/api", async (original) => ({
   ApiError: (await original<typeof import("@/lib/api")>()).ApiError,
   api: { post: h.post, get: h.get },
   objectsPath: () => "/objects",
   qs: () => "",
   cancelledError: () => new Error("cancelled"),
   isAborted: (error: unknown) =>
      error instanceof Error && error.name === "AbortError",
   errorMessage: String,
}));

import Modal from "./index";

type View = React.ReactElement<{
   onSubmit: (destination: string) => void;
   validate: (value: string) => string | null;
   submitLabel: string;
   requestError: string | null;
   children: unknown;
}>;

const picked = {
   prefix: "raw/",
   objects: [
      { key: "raw/a.txt", expectedETag: '"a"' },
      { key: "raw/deep/b.txt", expectedETag: '"b"' },
   ],
};
const callbacks = {
   onClose: vi.fn(),
   onMoved: vi.fn(),
   onMoveComplete: vi.fn(),
};
const render = (source: typeof picked | { folderKey: string } = picked) => {
   h.cursor = 0;
   return Modal({
      userId: "user",
      serverId: "server",
      bucketName: "bucket",
      source,
      ...callbacks,
   }) as View;
};
const move = async (destination: string, source = picked) => {
   render(source).props.onSubmit(destination);
   await Promise.all(h.pending);
};
const moveAll = async (
   _path: string,
   body: MoveBody
): Promise<S3MoveResult> => ({
   moved: body.objects.map(({ key }) => key),
   failed: [],
});

beforeEach(() => {
   vi.clearAllMocks();
   h.get.mockReset();
   h.post.mockReset().mockImplementation(moveAll);
   h.slots = [];
   h.cursor = 0;
   h.pending = [];
});

describe("moving picked objects", () => {
   it("sends each object to its own name under the destination", async () => {
      await move("archive/");
      expect(h.post.mock.calls[0]?.[1].objects).toEqual([
         { key: "raw/a.txt", newKey: "archive/a.txt", expectedETag: '"a"' },
         {
            key: "raw/deep/b.txt",
            newKey: "archive/b.txt",
            expectedETag: '"b"',
         },
      ]);
   });

   it("reports a clean move once and closes", async () => {
      await move("archive/");
      expect(callbacks.onMoved).toHaveBeenCalledOnce();
      expect(callbacks.onMoveComplete).toHaveBeenCalledExactlyOnceWith(
         "archive/"
      );
      expect(callbacks.onClose).toHaveBeenCalledOnce();
   });

   it("keeps the dialog open with a summary when part of the move fails", async () => {
      h.post.mockResolvedValueOnce({
         moved: ["raw/a.txt"],
         failed: [{ key: "raw/deep/b.txt", message: "Busy", retryable: true }],
      } satisfies S3MoveResult);
      await move("archive/");
      expect(callbacks.onMoved).toHaveBeenCalledOnce();
      expect(callbacks.onMoveComplete).not.toHaveBeenCalled();
      expect(callbacks.onClose).not.toHaveBeenCalled();
      const view = render();
      expect(view.props.requestError).toBe("Moved 1; 1 failed.");
      expect(view.props.submitLabel).toBe("Retry");
      await move("archive/");
      expect(h.post.mock.calls[1]?.[1].objects).toMatchObject([
         { key: "raw/deep/b.txt", newKey: "archive/b.txt" },
      ]);
      expect(callbacks.onMoveComplete).toHaveBeenCalledExactlyOnceWith(
         "archive/"
      );
      expect(callbacks.onClose).toHaveBeenCalledOnce();
   });

   it("refuses the folder the objects are already in", () => {
      const { validate } = render().props;
      expect(validate("raw/")).toBe("That's the current folder.");
      expect(validate("archive/")).toBeNull();
      expect(validate("")).toBeNull();
   });
});

describe("retrying after a cancel", () => {
   it("skips objects the cancelled batch already moved and finishes", async () => {
      h.post.mockRejectedValueOnce(
         Object.assign(new Error("aborted"), { name: "AbortError" })
      );
      await move("archive/");
      expect(render().props.requestError).toBe(
         "Cancelled, 0 moved. Retry to finish the rest."
      );
      h.post.mockResolvedValueOnce({ existing: ["raw/deep/b.txt"] });
      render().props.onSubmit("archive/");
      await vi.waitFor(() => expect(callbacks.onClose).toHaveBeenCalledOnce());
      expect(h.post.mock.calls[1]).toEqual([
         "/objects/exists",
         { objectKeys: ["raw/a.txt", "raw/deep/b.txt"] },
         expect.any(AbortSignal),
      ]);
      expect(h.post.mock.calls[2]?.[1].objects).toMatchObject([
         { key: "raw/deep/b.txt", newKey: "archive/b.txt" },
      ]);
      expect(callbacks.onMoveComplete).toHaveBeenCalledExactlyOnceWith(
         "archive/"
      );
      expect(render().props.requestError).toBe("Moved 2.");
   });
});

describe("renaming a folder", () => {
   const folder = { folderKey: "raw/" };

   it("refuses the same or an overlapping folder", () => {
      const { validate } = render(folder).props;
      expect(validate("raw/")).toBe("That's the current folder.");
      expect(validate("raw/deep/")).toBe(
         "Source and destination folders must not overlap."
      );
      expect(validate("archive/")).toBeNull();
   });

   it("says how far it got when a page fails", async () => {
      h.get.mockResolvedValue({
         objects: picked.objects,
         nextToken: "next",
      });
      h.post.mockResolvedValueOnce({
         moved: [],
         failed: picked.objects.map(({ key }) => ({
            key,
            message: "Busy",
            retryable: true,
         })),
      } satisfies S3MoveResult);
      render(folder).props.onSubmit("archive/");
      await Promise.all(h.pending);
      const view = render(folder);
      expect(view.props.requestError).toBe("Moved 0; 2 failed; more remain.");
      expect(view.props.submitLabel).toBe("Continue moving");
      expect(callbacks.onMoved).not.toHaveBeenCalled();
   });
});

describe("a folder that is already gone", () => {
   it("still reloads the listing when the move finishes having moved nothing", async () => {
      h.get.mockResolvedValue({ objects: [], nextToken: null });
      render({ folderKey: "raw/" }).props.onSubmit("archive/");
      await Promise.all(h.pending);
      expect(h.post).not.toHaveBeenCalled();
      expect(callbacks.onMoved).toHaveBeenCalledOnce();
      expect(callbacks.onMoveComplete).toHaveBeenCalledExactlyOnceWith(
         "archive/"
      );
      expect(callbacks.onClose).toHaveBeenCalledOnce();
   });
});

describe("room for what a move reports", () => {
   it("lists the failures under the field", async () => {
      h.post.mockResolvedValueOnce({
         moved: [],
         failed: picked.objects.map(({ key }) => ({
            key,
            message: "Denied",
            retryable: false,
         })),
      } satisfies S3MoveResult);
      await move("archive/");
      const children = render().props.children;
      expect(
         one(
            children,
            (element) => element.type === DeletionProtectionNotice,
            "notice"
         ).props
      ).toMatchObject({ serverId: "server", action: "move" });
      expect(
         one(children, (element) => element.type === FailureList, "failures")
            .props.failures
      ).toHaveLength(2);
   });
});
