import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { UploadFile } from "@/lib/utils/s3/dropEntries";
import type { S3ObjectsExist } from "@s3-viewer/types";

type Effect = { deps: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({
   session: { userId: "user-a", serverId: "server-a" },
   slots: [] as unknown[],
   cursor: 0,
   effects: new Map<number, Effect>(),
   queuedEffects: [] as (() => void)[],
   post: vi.fn(),
   enqueue: vi.fn(),
   forgetKeys: vi.fn(),
   toastError: vi.fn(),
   refresh: vi.fn(),
   queryClient: {},
}));

// Run the component's event handlers with controlled hook state/effect timing.
// This lets a preflight remain in flight while the selected session changes.
vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots))
         h.slots[index] = typeof initial === "function" ? initial() : initial;
      return [
         h.slots[index],
         (next: unknown) => {
            h.slots[index] =
               typeof next === "function" ? next(h.slots[index]) : next;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      h.slots[index] ??= { current };
      return h.slots[index];
   },
   useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
      const index = h.cursor++;
      const previous = h.effects.get(index);
      if (
         previous &&
         previous.deps.length === deps.length &&
         deps.every((value, i) => Object.is(value, previous.deps[i]))
      )
         return;
      h.queuedEffects.push(() => {
         previous?.cleanup?.();
         h.effects.set(index, { deps, cleanup: effect() || undefined });
      });
   },
   useCallback: (callback: unknown) => callback,
   useMemo: (factory: () => unknown) => factory(),
}));
vi.mock("@/lib/stores/sessionStore", () => ({
   default: Object.assign(
      (select: (state: typeof h.session) => unknown) => select(h.session),
      { getState: () => h.session }
   ),
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/stores/upload-store/uploadStore", () => ({
   default: (select: (state: { enqueue: typeof h.enqueue }) => unknown) =>
      select({ enqueue: h.enqueue }),
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({
      bucketName: "backups",
      prefix: "p/",
      refresh: h.refresh,
   }),
}));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: () => null,
}));
vi.mock("@/lib/hooks/mutations/object/invalidate", () => ({
   forgetKeys: h.forgetKeys,
}));
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => h.queryClient,
}));
vi.mock("@/lib/utils/toast", () => ({ toastError: () => h.toastError }));
vi.mock("@/lib/api", () => ({
   api: { post: h.post },
   objectsPath: (serverId: string, bucket: string) =>
      `/servers/${serverId}/buckets/${bucket}/objects`,
   cancelledError: () => new Error("cancelled"),
   isAborted: (error: unknown) =>
      error instanceof Error && error.message === "cancelled",
}));

import { UploadProvider } from "./provider";

type Uploader = {
   upload: (files: UploadFile[]) => Promise<void>;
   isChecking: boolean;
};
type Dialog = { open: boolean; onConfirm: () => void };
type Tree = React.ReactElement<{
   value: Uploader;
   children: [unknown, React.ReactElement<Dialog>];
}>;
const render = () => {
   h.cursor = 0;
   h.queuedEffects = [];
   const tree = UploadProvider({ children: null }) as Tree;
   return { uploader: tree.props.value, dialog: tree.props.children[1].props };
};
const flushEffects = () => {
   for (const effect of h.queuedEffects) effect();
   h.queuedEffects = [];
};
const mount = () => {
   render();
   flushEffects();
   return render();
};
const files: UploadFile[] = ["old.txt", "new.txt"].map((name) => ({
   file: new File(["contents"], name),
   relativePath: name,
}));
const original: S3ObjectsExist = {
   existing: ["p/old.txt"],
   eTags: { "p/old.txt": '"original-version"' },
};

beforeEach(() => {
   h.session = { userId: "user-a", serverId: "server-a" };
   h.slots = [];
   h.effects.clear();
   h.queuedEffects = [];
   vi.clearAllMocks();
   h.post.mockReset();
   h.post.mockResolvedValue(structuredClone(original));
   vi.stubGlobal("React", React);
});
afterEach(() => {
   for (const effect of h.effects.values()) effect.cleanup?.();
   vi.unstubAllGlobals();
});

describe("upload preflight and confirmation keep the reviewed target", () => {
   it("confirms only the originally observed ETag without a new preflight and invalidates the original target", async () => {
      const { uploader } = mount();
      await uploader.upload(files);
      expect(h.enqueue).not.toHaveBeenCalled();
      const { dialog } = render();
      expect(dialog.open).toBe(true);
      h.post.mockResolvedValue({
         existing: ["p/old.txt"],
         eTags: { "p/old.txt": '"new-unseen-version"' },
      });
      dialog.onConfirm();
      expect(h.post).toHaveBeenCalledTimes(1);
      expect(h.enqueue).toHaveBeenCalledWith(
         expect.objectContaining({
            serverId: "server-a",
            bucketName: "backups",
            prefix: "p/",
            files,
            eTags: { "p/old.txt": '"original-version"' },
         })
      );
      const queued = h.enqueue.mock.calls[0]![0] as {
         onComplete: () => void;
         eTags: Record<string, string>;
      };
      expect(Object.hasOwn(queued.eTags, "p/new.txt")).toBe(false);
      h.session = { userId: "user-b", serverId: "server-b" };
      render();
      flushEffects();
      queued.onComplete();
      expect(h.forgetKeys).toHaveBeenCalledWith(
         h.queryClient,
         "user-a",
         "server-a",
         "backups",
         ["p/old.txt", "p/new.txt"]
      );
      expect(h.refresh).not.toHaveBeenCalled();
   });

   it("starts new files without replacement permission", async () => {
      h.post.mockResolvedValue({ existing: [], eTags: {} });
      await mount().uploader.upload(files);
      expect(h.enqueue).toHaveBeenCalledWith(
         expect.objectContaining({ eTags: {} })
      );
      expect(render().dialog.open).toBe(false);
   });

   it("refuses unresolved existing files instead of treating confirmation as an unconditional overwrite", async () => {
      h.post.mockResolvedValue({ existing: ["p/old.txt"], eTags: {} });
      await mount().uploader.upload(files);
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(render().dialog.open).toBe(false);
      expect(h.toastError.mock.calls[0]![0]).toMatchObject({
         message: expect.stringContaining("Upload fewer files"),
      });
   });

   it.each([
      { userId: "user-a", serverId: "server-b" },
      { userId: "user-b", serverId: "server-a" },
   ])(
      "discards pending replacement after the session becomes %j",
      async (session) => {
         await mount().uploader.upload(files);
         const savedDialog = render().dialog;
         h.session = session;
         // Even an old event handler cannot start an upload before React rerenders.
         savedDialog.onConfirm();
         expect(h.enqueue).not.toHaveBeenCalled();
         expect(render().dialog.open).toBe(false);
         flushEffects();
      }
   );

   it.each([
      { userId: "user-a", serverId: "server-b" },
      { userId: "user-b", serverId: "server-a" },
   ])(
      "aborts and discards a preflight after the session becomes %j",
      async (session) => {
         let complete!: (result: S3ObjectsExist) => void;
         h.post.mockReturnValue(
            new Promise<S3ObjectsExist>((resolve) => {
               complete = resolve;
            })
         );
         const task = mount().uploader.upload(files);
         const signal = h.post.mock.calls[0]![2] as AbortSignal;
         h.session = session;
         render();
         flushEffects();
         expect(signal.aborted).toBe(true);
         complete(original);
         await task;
         expect(h.enqueue).not.toHaveBeenCalled();
         expect(h.toastError).not.toHaveBeenCalled();
         expect(render().dialog.open).toBe(false);
         expect(render().uploader.isChecking).toBe(false);
      }
   );
});
