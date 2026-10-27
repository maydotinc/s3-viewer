// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { act, createElement } from "react";
import { api, cancelledError } from "@/lib/api";
import type { BulkRenameSource } from "@/lib/contexts/modal-sources";
import { queryKeys } from "@/lib/query-keys";
import { deferred, flushRuntime } from "@/lib/test/runtime";
import type {
   S3KeysPage,
   S3MoveResult,
   S3ObjectsExist,
} from "@s3-viewer/shared";
import useBulkRename from "./useBulkRename";

vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);

const view = mountedRuntime(() => vi.restoreAllMocks());
let run!: ReturnType<typeof useBulkRename>;
const onClose = vi.fn();
const onRenamed = vi.fn();
const operation = { kind: "prefix", text: "new-" } as const;
const objects = [{ key: "photos/a.txt", expectedETag: '"a"', size: null }];
const source: BulkRenameSource = { objects };
const folder: BulkRenameSource = { folderKey: "photos/" };

const Probe = ({ selected = source }: { selected?: BulkRenameSource }) => {
   run = useBulkRename({
      userId: "user-a",
      serverId: "server-a",
      bucketName: "bucket",
      source: selected,
      operation,
      previewMatchesInput: true,
      onClose,
      onRenamed,
   });
   return createElement(
      "output",
      null,
      `${run.step ?? "ready"}:${run.sources?.length ?? 0}`
   );
};

beforeEach(() => vi.clearAllMocks());

describe("bulk rename with real StrictMode and QueryClient", () => {
   it("aborts the first StrictMode listing and finishes the replayed listing", async () => {
      const page = deferred<S3KeysPage>();
      const get = vi.spyOn(api, "get");
      const replayedPage = deferred<S3KeysPage>();
      get.mockImplementationOnce((_path, signal) => {
         signal?.addEventListener(
            "abort",
            () => page.reject(cancelledError()),
            { once: true }
         );
         return page.promise;
      }).mockImplementationOnce(() => replayedPage.promise);
      await view.mount(createElement(Probe, { selected: folder }));
      expect(get).toHaveBeenCalledTimes(2);
      expect(get.mock.calls[0]![1]?.aborted).toBe(true);
      expect(get.mock.calls[1]![1]?.aborted).toBe(false);
      await act(async () => {
         replayedPage.resolve({ objects, nextToken: null });
      });
      expect(view.current.container.textContent).toBe("ready:1");
      expect(run.sources).toEqual(objects);
      expect(run.error).toBeNull();
   });

   it("ignores listing progress and completion from an aborted StrictMode run", async () => {
      const oldPage = deferred<S3KeysPage>();
      const currentPage = deferred<S3KeysPage>();
      vi.spyOn(api, "get")
         .mockImplementationOnce(() => oldPage.promise)
         .mockImplementationOnce(() => currentPage.promise);
      await view.mount(createElement(Probe, { selected: folder }));
      await act(async () => oldPage.resolve({ objects, nextToken: null }));
      expect(run.step).toBe("listing");
      expect(run.sources).toBeNull();
      expect(run.listed).toBe(0);
      await act(async () =>
         currentPage.resolve({ objects: [], nextToken: null })
      );
      expect(view.current.container.textContent).toBe("ready:0");
   });

   it("closes a cancelled initial listing and ignores its late completion", async () => {
      const page = deferred<S3KeysPage>();
      const get = vi.spyOn(api, "get").mockImplementation(() => page.promise);
      await view.mount(createElement(Probe, { selected: folder }));
      await act(async () => run.cancel());
      expect(get.mock.calls[1]![1]?.aborted).toBe(true);
      expect(onClose).toHaveBeenCalledOnce();
      await act(async () => page.resolve({ objects, nextToken: null }));
      expect(run.sources).toBeNull();
      expect(run.listed).toBe(0);
      expect(onRenamed).not.toHaveBeenCalled();
   });

   it("aborts a listing on unmount", async () => {
      const get = vi.spyOn(api, "get").mockImplementation(
         (_path, signal) =>
            new Promise((_resolve, reject) => {
               signal?.addEventListener(
                  "abort",
                  () => reject(cancelledError()),
                  { once: true }
               );
            })
      );
      await view.mount(createElement(Probe, { selected: folder }));
      const signal = get.mock.calls[1]![1]!;
      await view.current.unmount();
      expect(signal.aborted).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(onRenamed).not.toHaveBeenCalled();
   });

   it.each(["success", "failure"])(
      "cancels preflight immediately and ignores its late %s after a new run starts",
      async (outcome) => {
         const oldCheck = deferred<S3ObjectsExist>();
         const nextCheck = deferred<S3ObjectsExist>();
         const post = vi
            .spyOn(api, "post")
            .mockImplementationOnce(() => oldCheck.promise)
            .mockImplementationOnce(() => nextCheck.promise)
            .mockResolvedValue({ moved: ["photos/a.txt"], failed: [] });
         await view.mount(createElement(Probe));
         await act(async () => run.submit());
         expect(run.step).toBe("checking");
         const signal = post.mock.calls[0]![2]!;
         await act(async () => run.cancel());
         expect(signal.aborted).toBe(true);
         expect(run.step).toBeNull();
         expect(onClose).not.toHaveBeenCalled();
         await act(async () => run.submit());
         expect(run.step).toBe("checking");
         await act(async () => {
            if (outcome === "success")
               oldCheck.resolve({ existing: [], eTags: {} });
            else oldCheck.reject(new Error("old preflight failed"));
         });
         expect(post).toHaveBeenCalledTimes(2);
         expect(run.step).toBe("checking");
         expect(run.error).toBeNull();
         expect(onClose).not.toHaveBeenCalled();
         await act(async () => nextCheck.resolve({ existing: [], eTags: {} }));
         await flushRuntime();
         expect(post).toHaveBeenCalledTimes(3);
         expect(onRenamed).toHaveBeenCalledOnce();
         expect(onClose).toHaveBeenCalledOnce();
      }
   );

   it("cancels an active mutation and settles the real mutation observer", async () => {
      const post = vi
         .spyOn(api, "post")
         .mockResolvedValueOnce({ existing: [], eTags: {} })
         .mockImplementationOnce(
            (_path, _body, signal) =>
               new Promise((_resolve, reject) => {
                  signal?.addEventListener(
                     "abort",
                     () => reject(cancelledError()),
                     { once: true }
                  );
               })
         );
      await view.mount(createElement(Probe));
      await act(async () => run.submit());
      expect(run.step).toBe("renaming");
      expect(view.current.queryClient.isMutating()).toBe(1);
      const signal = post.mock.calls[1]![2]!;
      await act(async () => run.cancel());
      await flushRuntime();
      expect(signal.aborted).toBe(true);
      expect(view.current.queryClient.isMutating()).toBe(0);
      expect(
         view.current.queryClient.getMutationCache().getAll()[0]?.state.status
      ).toBe("success");
      expect(run.step).toBeNull();
      expect(run.error).toContain("Cancelled, 0 renamed");
      expect(onClose).not.toHaveBeenCalled();
      expect(onRenamed).not.toHaveBeenCalled();
   });

   it("aborts on unmount and suppresses late mutation callbacks while invalidating the original cache", async () => {
      const response = deferred<S3MoveResult>();
      const post = vi
         .spyOn(api, "post")
         .mockResolvedValueOnce({ existing: [], eTags: {} })
         .mockImplementationOnce(() => response.promise);
      await view.mount(createElement(Probe));
      const original = queryKeys.objectPreview(
         "user-a",
         "server-a",
         "bucket",
         "photos/a.txt"
      );
      const other = queryKeys.objectPreview(
         "user-b",
         "server-b",
         "bucket",
         "photos/a.txt"
      );
      view.current.queryClient.setQueryData(original, "old preview");
      view.current.queryClient.setQueryData(other, "other preview");
      await act(async () => run.submit());
      const signal = post.mock.calls[1]![2]!;
      await view.current.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () =>
         response.resolve({ moved: ["photos/a.txt"], failed: [] })
      );
      await flushRuntime();
      expect(view.current.queryClient.isMutating()).toBe(0);
      expect(view.current.queryClient.getQueryData(original)).toBeUndefined();
      expect(view.current.queryClient.getQueryData(other)).toBe(
         "other preview"
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(onRenamed).not.toHaveBeenCalled();
   });
});
