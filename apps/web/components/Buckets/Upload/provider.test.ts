import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { UploadFile } from "@/lib/utils/s3/drop-entries";
import { MAX_BATCH_KEYS, type S3ObjectsExist } from "@s3-viewer/shared";
import { MAX_UPLOAD_FILES } from "@/lib/utils/s3/drop-entries";

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
   toast: { error: vi.fn() },
   notify: vi.fn(),
   queryClient: {},
   prefix: "p/",
   canUpload: true,
}));

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
vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign(
      (select: (state: typeof h.session) => unknown) => select(h.session),
      { getState: () => h.session }
   ),
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/stores/upload-store/upload-store", () => ({
   default: (select: (state: { enqueue: typeof h.enqueue }) => unknown) =>
      select({ enqueue: h.enqueue }),
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({
      bucketName: "backups",
      prefix: h.prefix,
   }),
}));
vi.mock("@/lib/hooks/useStorageCapabilities", () => ({
   useStorageCapabilities: () => ({ notice: null }),
}));
vi.mock("@/components/Buckets/useObjectCommands", () => ({
   default: () => ({ can: { upload: h.canUpload } }),
}));
vi.mock("@/lib/listing-events", () => ({ notifyListingChanged: h.notify }));
vi.mock("./replace-dialog", () => ({ ReplaceDialog: () => null }));
vi.mock("@/lib/hooks/mutations/object/invalidate", () => ({
   forgetKeys: h.forgetKeys,
}));
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => h.queryClient,
}));
vi.mock("@/lib/utils/toast", () => ({ toastError: () => h.toastError }));
vi.mock("@s3-viewer/ui/components/toast", () => ({ toast: h.toast }));
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
type Dialog = {
   open: boolean;
   existing: string[];
   pendingFileCount: number;
   dropFileCount: number;
   onReplaceAll: () => void;
   onSkipExisting: () => void;
   onCancel: () => void;
};
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
   h.prefix = "p/";
   h.canUpload = true;
   h.session = { userId: "user-a", serverId: "server-a" };
   h.slots = [];
   h.effects.clear();
   h.queuedEffects = [];
   vi.clearAllMocks();
   h.post.mockReset();
   h.post.mockResolvedValue(structuredClone(original));
});
afterEach(() => {
   for (const effect of h.effects.values()) effect.cleanup?.();
});

describe("upload preflight and confirmation keep the reviewed target", () => {
   it("does not preflight or enqueue files when provider uploads are unavailable", async () => {
      h.canUpload = false;
      await mount().uploader.upload(files);
      expect(h.post).not.toHaveBeenCalled();
      expect(h.enqueue).not.toHaveBeenCalled();
   });

   it("refuses a pending replacement after upload capability is removed", async () => {
      await mount().uploader.upload(files);
      const oldDialog = render().dialog;
      h.canUpload = false;
      expect(render().dialog.open).toBe(false);
      oldDialog.onReplaceAll();
      expect(h.enqueue).not.toHaveBeenCalled();
   });
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
      dialog.onReplaceAll();
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
         onSettled: (keys: string[]) => void;
         eTags: Record<string, string>;
      };
      expect(Object.hasOwn(queued.eTags, "p/new.txt")).toBe(false);
      h.session = { userId: "user-b", serverId: "server-b" };
      render();
      flushEffects();
      queued.onSettled(["p/old.txt", "p/new.txt"]);
      expect(h.forgetKeys).toHaveBeenCalledWith(
         h.queryClient,
         "user-a",
         "server-a",
         "backups",
         ["p/old.txt", "p/new.txt"]
      );
      expect(h.notify).toHaveBeenCalledExactlyOnceWith({
         serverId: "server-a",
         bucketName: "backups",
         keys: ["p/old.txt", "p/new.txt"],
      });
   });

   it("uploads only the non-colliding files when existing ones are skipped", async () => {
      const { uploader } = mount();
      await uploader.upload(files);
      const { dialog } = render();
      expect(dialog).toMatchObject({
         open: true,
         existing: ["old.txt"],
         dropFileCount: 2,
      });
      dialog.onSkipExisting();
      expect(h.post).toHaveBeenCalledTimes(1);
      expect(h.enqueue).toHaveBeenCalledWith(
         expect.objectContaining({
            prefix: "p/",
            files: [files[1]],
            eTags: {},
         })
      );
      expect(render().dialog.open).toBe(false);
   });

   it("enqueues nothing when every selected file already exists", async () => {
      h.post.mockResolvedValue({
         existing: ["p/old.txt", "p/new.txt"],
         eTags: { "p/old.txt": '"a"', "p/new.txt": '"b"' },
      });
      const { uploader } = mount();
      await uploader.upload(files);
      const { dialog } = render();
      expect(dialog.existing).toEqual(["old.txt", "new.txt"]);
      dialog.onSkipExisting();
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(render().dialog.open).toBe(false);
   });

   it("discards the pending files when the replace prompt is cancelled", async () => {
      const { uploader } = mount();
      await uploader.upload(files);
      render().dialog.onCancel();
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(render().dialog.open).toBe(false);
   });

   it("refuses a skip after upload capability is removed", async () => {
      await mount().uploader.upload(files);
      const oldDialog = render().dialog;
      h.canUpload = false;
      expect(render().dialog.open).toBe(false);
      oldDialog.onSkipExisting();
      expect(h.enqueue).not.toHaveBeenCalled();
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
         savedDialog.onReplaceAll();
         expect(h.enqueue).not.toHaveBeenCalled();
         expect(render().dialog.open).toBe(false);
         flushEffects();
      }
   );
});

describe("large drops", () => {
   const many = (total: number): UploadFile[] =>
      Array.from({ length: total }, (_, index) => ({
         file: new File(["x"], `f${index}.txt`),
         relativePath: `f${index}.txt`,
      }));

   it("refuses a drop over the file cap before checking anything", async () => {
      await mount().uploader.upload(many(MAX_UPLOAD_FILES + 1));
      expect(h.post).not.toHaveBeenCalled();
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(h.toast.error).toHaveBeenCalledWith(
         expect.stringContaining("files at a time")
      );
   });

   it("starts the first chunk while later chunks are still being checked", async () => {
      const files = many(MAX_BATCH_KEYS + 1);
      let finishSecond!: (result: S3ObjectsExist) => void;
      h.post
         .mockResolvedValueOnce({ existing: [], eTags: {} })
         .mockReturnValueOnce(
            new Promise<S3ObjectsExist>((resolve) => {
               finishSecond = resolve;
            })
         );
      const task = mount().uploader.upload(files);
      await vi.waitFor(
         () => {
            expect(h.post).toHaveBeenCalledTimes(2);
            expect(h.enqueue).toHaveBeenCalledTimes(1);
         },
         { interval: 1 }
      );
      expect(h.enqueue.mock.calls[0]![0]).toMatchObject({
         files: files.slice(0, MAX_BATCH_KEYS),
      });
      expect(render().uploader.isChecking).toBe(true);
      finishSecond({ existing: [], eTags: {} });
      await task;
      expect(h.enqueue).toHaveBeenCalledTimes(2);
      expect(h.enqueue.mock.calls[1]![0]).toMatchObject({
         files: files.slice(MAX_BATCH_KEYS),
      });
      expect(render().uploader.isChecking).toBe(false);
   });

   it("holds only the colliding chunk for the replace prompt", async () => {
      const files = many(MAX_BATCH_KEYS + 2);
      h.post
         .mockResolvedValueOnce({ existing: [], eTags: {} })
         .mockResolvedValueOnce({
            existing: [`p/f${MAX_BATCH_KEYS}.txt`],
            eTags: { [`p/f${MAX_BATCH_KEYS}.txt`]: '"seen"' },
         });
      await mount().uploader.upload(files);
      expect(h.enqueue).toHaveBeenCalledTimes(1);
      const { dialog } = render();
      expect(dialog).toMatchObject({
         open: true,
         existing: [`f${MAX_BATCH_KEYS}.txt`],
         pendingFileCount: 2,
         dropFileCount: files.length,
      });
      dialog.onSkipExisting();
      expect(h.enqueue).toHaveBeenCalledTimes(2);
      expect(h.enqueue.mock.calls[1]![0]).toMatchObject({
         files: [files[MAX_BATCH_KEYS + 1]],
         eTags: {},
      });
   });
});

describe("full upload key validation", () => {
   it("refuses an invalid full destination before checking or enqueueing any files", async () => {
      await mount().uploader.upload([
         ...files,
         { file: new File(["x"], "file"), relativePath: "é".repeat(512) },
      ]);
      expect(h.post).not.toHaveBeenCalled();
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(h.toast.error).toHaveBeenCalledWith(
         expect.stringContaining("Invalid upload key")
      );
   });
});

describe("dropping only empty folders", () => {
   it("says nothing was uploaded instead of doing nothing", async () => {
      await mount().uploader.upload([]);
      expect(h.post).not.toHaveBeenCalled();
      expect(h.toast.error).toHaveBeenCalledWith(
         expect.stringContaining("folders are empty")
      );
   });
});
