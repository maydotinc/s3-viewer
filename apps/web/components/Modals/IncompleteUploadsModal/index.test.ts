// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   buttonByText,
   mountedRuntime,
   submitForm,
} from "@/components/test-helpers";
import { deferred, flushRuntime } from "@/lib/test/runtime";
import type {
   S3AbortUploadsResult,
   S3MultipartUploadPage,
   S3UploadRef,
} from "@s3-viewer/types";
import Modal from "./index";

const h = vi.hoisted(() => ({
   get: vi.fn(),
   remove: vi.fn(),
   reach: undefined as unknown,
}));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: h.get, delete: h.remove },
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user1" }));
vi.mock("@/lib/hooks/queries/s3/useBucketScope", () => ({
   default: () => h.reach,
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);

const upload = (key: string, uploadId: string) => ({
   key,
   uploadId,
   initiated: "2026-09-01T00:00:00.000Z",
   storageClass: "STANDARD",
});
const uploads = [upload("photos/a.bin", "u1"), upload("photos/b.bin", "u2")];
const page = (
   list = uploads,
   nextKeyMarker: string | null = null
): S3MultipartUploadPage => ({
   uploads: list,
   nextKeyMarker,
   nextUploadIdMarker: nextKeyMarker,
});
const refused = (
   aborted: S3UploadRef[],
   failed: S3AbortUploadsResult["failed"]
) => h.remove.mockReset().mockResolvedValue({ aborted, failed });

const onClose = vi.fn();
const onAborted = vi.fn();
const view = mountedRuntime();
const button = (label: string) =>
   buttonByText(view.current.container, label, "prefix");
const open = async (prefix = "photos/") => {
   await view.mount(
      createElement(Modal, {
         onClose,
         userId: "user1",
         serverId: "server1",
         bucketName: "bucket",
         prefix,
         onAborted,
      })
   );
   await flushRuntime();
};
const press = async (label: string) => {
   await act(async () => button(label)!.click());
   await flushRuntime();
};
const select = (key: string) =>
   act(async () =>
      view.current.container
         .querySelector<HTMLButtonElement>(`[aria-label="Select ${key}"]`)!
         .click()
   );
const submit = async () => {
   await act(async () => submitForm(view.current.container));
   await flushRuntime();
};
const sent = () =>
   h.remove.mock.calls.map((call) =>
      (call[1] as { uploads: S3UploadRef[] }).uploads.map(
         ({ key, uploadId }) => ({ key, uploadId })
      )
   );

beforeEach(() => {
   vi.clearAllMocks();
   h.reach = { folders: null, owner: false };
   h.get
      .mockReset()
      .mockImplementation(async (path: string) =>
         path.includes("keyMarker=") ? page([]) : page()
      );
   h.remove.mockReset().mockImplementation(
      async (
         _path: string,
         body: { uploads: S3UploadRef[] }
      ): Promise<S3AbortUploadsResult> => ({
         aborted: body.uploads,
         failed: [],
      })
   );
});

describe("incomplete uploads dialog", () => {
   it("lists the uploads for the current prefix", async () => {
      await open();
      expect(view.text()).toContain("photos/a.bin");
      expect(view.text()).toContain("2 listed");
      expect(button("Abort selected")!.disabled).toBe(true);
      expect(button("Load more")).toBeUndefined();
   });

   it("says when the prefix holds none, and that only shared folders were checked", async () => {
      h.get.mockResolvedValue(page([]));
      await open();
      expect(view.text()).toContain("No incomplete uploads under photos/");
      h.reach = { folders: ["landing/"], owner: false };
      await open("");
      expect(view.text()).toContain("No incomplete uploads in your folders.");
   });

   it("doesn't ask for a prefix only the server owner may list", async () => {
      await open("a/../");
      expect(h.get).not.toHaveBeenCalled();
      h.reach = { folders: null, owner: true };
      await open("a/../");
      expect(h.get).toHaveBeenCalled();
   });

   it("aborts only the rows that were picked", async () => {
      await open();
      await select("photos/a.bin");
      expect(button("Abort selected")!.textContent).toBe("Abort selected (1)");
      await submit();
      expect(sent()).toEqual([[{ key: "photos/a.bin", uploadId: "u1" }]]);
      expect(onAborted).toHaveBeenCalledOnce();
   });

   it("asks once more before aborting everything listed", async () => {
      await open();
      await press("Abort all listed");
      expect(h.remove).not.toHaveBeenCalled();
      expect(view.text()).toContain("Confirm aborting 2");
      await press("Confirm aborting");
      expect(sent()).toEqual([
         [
            { key: "photos/a.bin", uploadId: "u1" },
            { key: "photos/b.bin", uploadId: "u2" },
         ],
      ]);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("stays open after aborting every listed row while more pages remain", async () => {
      h.get.mockImplementation(async (path: string) =>
         path.includes("keyMarker=") ? page([]) : page(uploads, "photos/b.bin")
      );
      await open();
      expect(view.text()).toContain("2 listed+");
      await press("Abort all listed");
      await press("Confirm aborting");
      expect(onAborted).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      await press("Load more");
      expect(
         h.get.mock.calls.some(([path]) =>
            String(path).includes("keyMarker=photos%2Fb.bin")
         )
      ).toBe(true);
   });

   it("keeps the refused rows selected with their reason", async () => {
      refused(
         [{ key: "photos/a.bin", uploadId: "u1" }],
         [{ key: "photos/b.bin", uploadId: "u2", message: "Access denied" }]
      );
      await open();
      await press("Abort all listed");
      await press("Confirm aborting");
      expect(view.text()).toContain("Access denied");
      expect(button("Abort selected")!.textContent).toBe("Abort selected (1)");
      expect(onClose).not.toHaveBeenCalled();
      await submit();
      expect(sent()[1]).toEqual([{ key: "photos/b.bin", uploadId: "u2" }]);
   });

   it("surfaces a listing error instead of an empty table", async () => {
      h.get.mockRejectedValue(new Error("Access denied"));
      await open();
      expect(view.text()).toContain("Access denied");
   });

   it("refreshes on demand and clears the previous failures", async () => {
      refused(
         [],
         [{ key: "photos/a.bin", uploadId: "u1", message: "Access denied" }]
      );
      await open();
      await press("Abort all listed");
      await press("Confirm aborting");
      expect(view.text()).toContain("Access denied");
      const listed = h.get.mock.calls.length;
      await press("Refresh");
      expect(h.get.mock.calls.length).toBeGreaterThan(listed);
      expect(view.text()).not.toContain("Access denied");
   });

   it("aborts an in-flight run when it is closed", async () => {
      const result = deferred<S3AbortUploadsResult>();
      let signal: AbortSignal | undefined;
      h.remove.mockImplementation(
         (_path: string, _body: unknown, given: AbortSignal) => {
            signal = given;
            return result.promise;
         }
      );
      await open();
      await select("photos/a.bin");
      await submit();
      expect(signal?.aborted).toBe(false);
      await view.current.unmount();
      expect(signal?.aborted).toBe(true);
      await act(async () =>
         result.resolve({
            aborted: [{ key: "photos/a.bin", uploadId: "u1" }],
            failed: [],
         })
      );
      await flushRuntime();
      expect(onAborted).not.toHaveBeenCalled();
   });
});
