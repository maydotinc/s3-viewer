// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { act, createElement } from "react";
import { Storage } from "happy-dom";
import { createJSONStorage } from "zustand/middleware";
import type { S3ObjectsExist } from "@s3-viewer/types";
import { api } from "@/lib/api";
import useSessionStore from "@/lib/stores/session-store";
import { deferred } from "@/lib/test/runtime";
import type { KnownReach } from "@/lib/utils/folder-access";
import { UploadProvider, useUploader } from "./provider";

const h = vi.hoisted(() => ({
   enqueue: vi.fn(),
   refresh: vi.fn(),
   error: vi.fn(),
   prefix: "p/",
   reach: undefined as KnownReach,
}));

vi.mock("@/lib/stores/upload-store/upload-store", () => ({
   default: (select: (state: { enqueue: typeof h.enqueue }) => unknown) =>
      select({ enqueue: h.enqueue }),
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({
      bucketName: "backups",
      prefix: h.prefix,
      reach: h.reach,
      reloadListing: h.refresh,
   }),
}));
vi.mock("@/lib/hooks/useStorageCapabilities", () => ({
   useStorageCapabilities: () => ({
      upload: true,
      replace: true,
      notice: null,
   }),
}));
vi.mock("@/lib/hooks/usePermission", () => ({ usePermission: () => true }));
vi.mock("@/lib/utils/toast", () => ({ toastError: () => h.error }));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ error: h.error })
);
vi.mock("./replace-dialog", () => ({
   ReplaceDialog: ({ open }: { open: boolean }) =>
      createElement(
         "output",
         { "data-replacement": true },
         open ? "replace" : "closed"
      ),
}));

const view = mountedRuntime(() => {
   vi.restoreAllMocks();
   vi.useRealTimers();
});
let upload!: ReturnType<typeof useUploader>["upload"];
const files = [
   { file: new File(["contents"], "file.txt"), relativePath: "file.txt" },
];

const Probe = () => {
   const uploader = useUploader();
   upload = uploader.upload;
   return createElement(
      "output",
      { "data-checking": true },
      String(uploader.isChecking)
   );
};

beforeEach(() => {
   vi.clearAllMocks();
   h.prefix = "p/";
   h.reach = undefined;
   useSessionStore.persist.setOptions({
      storage: createJSONStorage(() => new Storage()),
   });
   useSessionStore.setState({ userId: "user-a", serverId: "server-a" });
});

describe("upload preflight with the real React runtime", () => {
   it.each(["account", "server"] as const)(
      "aborts preflight on a %s switch and accepts a new upload without the old response taking over",
      async (scope) => {
         const oldResponse = deferred<S3ObjectsExist>();
         const nextResponse = deferred<S3ObjectsExist>();
         const post = vi
            .spyOn(api, "post")
            .mockImplementationOnce(() => oldResponse.promise)
            .mockImplementationOnce(() => nextResponse.promise);
         await view.mount(
            createElement(UploadProvider, null, createElement(Probe))
         );
         let oldUpload!: Promise<void>;
         await act(async () => {
            oldUpload = upload(files);
         });
         const oldSignal = post.mock.calls[0]![2]!;
         expect(oldSignal.aborted).toBe(false);
         expect(
            view.current.container.querySelector("[data-checking]")?.textContent
         ).toBe("true");

         await act(async () => {
            if (scope === "account") {
               useSessionStore.getState().setUserId("user-b");
               useSessionStore.getState().setServerId("server-a");
            } else useSessionStore.getState().setServerId("server-b");
         });
         expect(oldSignal.aborted).toBe(true);
         expect(
            view.current.container.querySelector("[data-checking]")?.textContent
         ).toBe("false");

         let nextUpload!: Promise<void>;
         await act(async () => {
            nextUpload = upload(files);
         });
         const nextSignal = post.mock.calls[1]![2]!;
         expect(nextSignal.aborted).toBe(false);
         await act(async () => {
            oldResponse.resolve({
               existing: ["p/file.txt"],
               eTags: { "p/file.txt": '"old"' },
            });
            await oldUpload;
         });
         expect(h.enqueue).not.toHaveBeenCalled();
         expect(
            view.current.container.querySelector("[data-replacement]")
               ?.textContent
         ).toBe("closed");
         expect(
            view.current.container.querySelector("[data-checking]")?.textContent
         ).toBe("true");

         await act(async () => {
            nextResponse.resolve({ existing: [], eTags: {} });
            await nextUpload;
         });
         expect(h.enqueue).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
               serverId: scope === "server" ? "server-b" : "server-a",
               bucketName: "backups",
               files,
            })
         );
         expect(
            view.current.container.querySelector("[data-checking]")?.textContent
         ).toBe("false");
         expect(h.error).not.toHaveBeenCalled();
      }
   );

   it("aborts preflight when the provider unmounts", async () => {
      const response = deferred<S3ObjectsExist>();
      const post = vi
         .spyOn(api, "post")
         .mockImplementationOnce(() => response.promise);
      await view.mount(
         createElement(UploadProvider, null, createElement(Probe))
      );
      let pending!: Promise<void>;
      await act(async () => {
         pending = upload(files);
      });
      const signal = post.mock.calls[0]![2]!;
      await view.current.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
         response.resolve({ existing: [], eTags: {} });
         await pending;
      });
      expect(h.enqueue).not.toHaveBeenCalled();
      expect(h.error).not.toHaveBeenCalled();
   });

   it("gives up on a preflight that never answers and lets the next upload start", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      vi.spyOn(api, "post").mockImplementation(
         (_path, _body, signal) =>
            new Promise((_resolve, reject) =>
               signal?.addEventListener("abort", () => reject(signal.reason))
            )
      );
      await view.mount(
         createElement(UploadProvider, null, createElement(Probe))
      );
      let pending!: Promise<void>;
      await act(async () => {
         pending = upload(files);
      });
      expect(
         view.current.container.querySelector("[data-checking]")?.textContent
      ).toBe("true");
      await act(async () => {
         vi.advanceTimersByTime(74_999);
      });
      expect(h.error).not.toHaveBeenCalled();
      await act(async () => {
         vi.advanceTimersByTime(1);
         await pending;
      });
      expect(h.error).toHaveBeenCalledExactlyOnceWith(
         expect.stringContaining("took too long")
      );
      expect(
         view.current.container.querySelector("[data-checking]")?.textContent
      ).toBe("false");
      expect(h.enqueue).not.toHaveBeenCalled();
   });
});

describe("where uploads can land", () => {
   const Gate = () => {
      const { canUpload, blockedReason } = useUploader();
      return createElement(
         "output",
         { "data-gate": true },
         JSON.stringify({ canUpload, blockedReason })
      );
   };
   const gate = async () => {
      await view.mount(
         createElement(UploadProvider, null, createElement(Gate))
      );
      return JSON.parse(
         view.current.container.querySelector("[data-gate]")?.textContent ??
            "{}"
      ) as { canUpload: boolean; blockedReason: string | null };
   };

   it("turns them off outside someone's folders, and says where they can go", async () => {
      h.reach = { folders: ["landing/"], owner: false };
      expect(await gate()).toEqual({
         canUpload: false,
         blockedReason: "You can only add files and folders inside landing/.",
      });
      await view.current.unmount();
      h.prefix = "landing/hero/";
      expect(await gate()).toEqual({ canUpload: true, blockedReason: null });
   });
});
