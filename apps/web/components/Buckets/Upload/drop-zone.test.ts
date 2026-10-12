// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import DropZone from "./drop-zone";

const h = vi.hoisted(() => ({
   upload: vi.fn(),
   error: vi.fn(),
   canUpload: true,
   isChecking: false,
   isLoading: false,
   blockedReason: null as string | null,
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({
      bucketName: "bucket",
      prefix: "folder/",
      isLoading: h.isLoading,
   }),
}));
vi.mock("./provider", () => ({
   STILL_CHECKING: "Still checking the last upload.",
   useUploader: () => ({
      upload: h.upload,
      canUpload: h.canUpload,
      isChecking: h.isChecking,
      blockedReason: h.blockedReason,
   }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ error: h.error })
);

const OUTSIDE = "You can only add files and folders inside landing/.";

const view = mountedRuntime(() => vi.unstubAllGlobals());
const mount = async () => {
   await view.mount(createElement(DropZone, null, null));
};
const fire = async (
   type: string,
   dataTransfer: Record<string, unknown> = { types: ["Files"], items: [] }
) => {
   const event = new Event(type, { bubbles: true, cancelable: true });
   Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
   await act(async () => {
      view.current.container.firstElementChild!.dispatchEvent(event);
   });
   return event;
};
const drop = (entry: unknown) =>
   fire("drop", {
      types: ["Files"],
      items: [{ kind: "file", webkitGetAsEntry: () => entry }],
   });

beforeEach(() => {
   vi.clearAllMocks();
   h.canUpload = true;
   h.isChecking = false;
   h.isLoading = false;
   h.blockedReason = null;
});

describe("dropped entries", () => {
   it.each(["directory", "file"])(
      "handles rejected %s readers without enqueuing files",
      async (kind) => {
         await mount();
         const reject = (_resolve: unknown, failure: (error: Error) => void) =>
            failure(new Error("Cannot read entry"));
         await drop(
            kind === "directory"
               ? {
                    isDirectory: true,
                    createReader: () => ({ readEntries: reject }),
                 }
               : { isFile: true, file: reject }
         );
         await vi.waitFor(() => expect(h.error).toHaveBeenCalledOnce());
         expect(h.error).toHaveBeenCalledWith("Cannot read entry");
         expect(h.upload).not.toHaveBeenCalled();
      }
   );

   it("preserves valid dropped files and their relative paths", async () => {
      await mount();
      const file = new File(["contents"], "config.json");
      await drop({
         isFile: true,
         fullPath: "/folder/config.json",
         file: (resolve: (file: File) => void) => resolve(file),
      });
      await vi.waitFor(() => expect(h.upload).toHaveBeenCalledOnce());
      expect(h.upload).toHaveBeenCalledWith([
         { file, relativePath: "folder/config.json" },
      ]);
      expect(h.error).not.toHaveBeenCalled();
   });
});

describe("where uploads aren't allowed", () => {
   it.each([
      ["outside someone's folders", OUTSIDE],
      ["without upload permission", null],
   ])("keeps a drop %s from opening the file", async (_case, reason) => {
      h.canUpload = false;
      h.blockedReason = reason;
      await mount();
      const dataTransfer = { types: ["Files"], items: [], dropEffect: "" };
      expect((await fire("dragover", dataTransfer)).defaultPrevented).toBe(
         true
      );
      expect(dataTransfer.dropEffect).toBe("none");
      expect((await fire("drop")).defaultPrevented).toBe(true);
      expect(h.upload).not.toHaveBeenCalled();
   });

   it("says why while files are dragged over", async () => {
      h.canUpload = false;
      h.blockedReason = OUTSIDE;
      await mount();
      await fire("dragenter");
      expect(view.text()).toContain(OUTSIDE);
   });
});

describe("drops and drags while busy", () => {
   it("refuses a second drop while the first is still being checked, instead of silently cancelling it", async () => {
      h.isChecking = true;
      await mount();
      expect((await fire("drop")).defaultPrevented).toBe(true);
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledWith(
         expect.stringContaining("Still checking")
      );
   });

   it("refuses a drop while an earlier drop's folder walk is still running", async () => {
      await mount();
      let read!: (file: File) => void;
      await drop({
         isFile: true,
         fullPath: "/a.txt",
         file: (resolve: (file: File) => void) => {
            read = resolve;
         },
      });
      await fire("drop");
      expect(h.error).toHaveBeenCalledWith(
         expect.stringContaining("Still checking")
      );
      read(new File(["a"], "a.txt"));
      await vi.waitFor(() => expect(h.upload).toHaveBeenCalledOnce());
   });

   it("ignores drops until the bucket has loaded", async () => {
      h.isLoading = true;
      await mount();
      expect((await fire("drop")).defaultPrevented).toBe(true);
      expect(h.upload).not.toHaveBeenCalled();
      expect(h.error).not.toHaveBeenCalled();
   });

   it("hides the overlay when the pointer leaves even if a child never sent dragleave", async () => {
      await mount();
      await fire("dragenter");
      await fire("dragenter");
      expect(view.text()).toContain("Drop to upload");
      const leave = new Event("dragleave", { bubbles: true });
      Object.defineProperty(leave, "relatedTarget", { value: document.body });
      await act(async () => {
         view.current.container.firstElementChild!.dispatchEvent(leave);
      });
      expect(view.text()).not.toContain("Drop to upload");
   });
});
