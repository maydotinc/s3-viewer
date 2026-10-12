// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";

const h = vi.hoisted(() => ({
   state: {
      order: ["a"],
      batch: {
         ids: ["a"],
         settled: false,
         completed: 0,
         failed: 0,
         refusal: null,
      },
      isUploading: true,
      cancel: () => undefined,
      cancelAll: () => undefined,
      cancelAllAndClear: (() => Promise.resolve()) as () => Promise<void>,
   },
}));
vi.mock("@/lib/stores/upload-store/upload-store", () => ({
   default: (select: (state: typeof h.state) => unknown) => select(h.state),
}));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: ({
      open,
      onConfirm,
   }: {
      open: boolean;
      onConfirm: () => void;
   }) =>
      open
         ? createElement(
              "button",
              { "data-confirm": true, onClick: onConfirm },
              "confirm"
           )
         : null,
}));
import UploadProgressSheet from "./upload-progress";

const view = mountedRuntime();
const clear = vi.fn(() => Promise.resolve());
const click = (selector: string) =>
   act(async () => {
      view.current.container
         .querySelector<HTMLElement>(selector)!
         .dispatchEvent(new MouseEvent("click", { bubbles: true }));
   });

beforeEach(() => {
   clear.mockClear();
   h.state.cancelAllAndClear = clear;
});

describe("closing the upload sheet", () => {
   it("asks before cancelling uploads that are still running", async () => {
      h.state.isUploading = true;
      await view.mount(createElement(UploadProgressSheet));
      await click('[aria-label="Cancel uploads and close"]');
      expect(clear).not.toHaveBeenCalled();
      await click("[data-confirm]");
      expect(clear).toHaveBeenCalledOnce();
      expect(view.current.container.querySelector("[data-confirm]")).toBeNull();
   });

   it("closes at once when nothing is running", async () => {
      h.state.isUploading = false;
      await view.mount(createElement(UploadProgressSheet));
      await click('[aria-label="Close"]');
      expect(clear).toHaveBeenCalledOnce();
      expect(view.current.container.querySelector("[data-confirm]")).toBeNull();
   });
});
