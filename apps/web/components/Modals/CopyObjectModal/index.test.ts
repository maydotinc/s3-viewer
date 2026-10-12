// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";
import Modal from "./index";

const h = vi.hoisted(() => ({ occupiedBy: vi.fn(), mutate: vi.fn() }));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@/lib/hooks/queries/s3/useBucketScope", () => ({
   default: () => undefined,
}));
vi.mock("@/lib/hooks/usePathSuggestion", () => ({
   usePathSuggestion: () => "",
   isAcceptSuggestionKey: () => false,
}));
vi.mock("@/lib/hooks/mutations/object/useCopyObject", () => ({
   default: () => ({ isPending: false, mutate: h.mutate }),
}));
vi.mock("@/lib/utils/s3/key-exists", () => ({ occupiedBy: h.occupiedBy }));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);

const view = mountedRuntime(() => vi.unstubAllGlobals());
const input = () => view.current.container.querySelector("input")!;
const press = async (label: string) =>
   act(async () => buttonByText(view.current.container, label)!.click());
const open = async () => {
   await view.mount(
      createElement(Modal, {
         onClose: vi.fn(),
         userId: "user1",
         serverId: "server1",
         bucketName: "bucket",
         objectKey: "reports/a.pdf",
         expectedETag: '"source"',
      })
   );
};
const submit = async (key: string) => {
   await act(async () => {
      Object.getOwnPropertyDescriptor(
         HTMLInputElement.prototype,
         "value"
      )!.set!.call(input(), key);
      input().dispatchEvent(new Event("input", { bubbles: true }));
   });
   await act(async () =>
      view.current.container
         .querySelector("form")!
         .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
         )
   );
   await flushRuntime();
};

beforeEach(() => {
   vi.clearAllMocks();
   h.occupiedBy.mockResolvedValue('"taken"');
});

describe("copy object destination after a replace prompt", () => {
   it("keeps the typed destination when the replace prompt is cancelled", async () => {
      await open();
      expect(input().value).toBe("reports/a.pdf");
      await submit("reports/b.pdf");
      expect(view.current.container.textContent).toContain(
         "reports/b.pdf already exists"
      );
      await press("Cancel");
      expect(view.current.container.textContent).toContain("Copy object");
      expect(input().value).toBe("reports/b.pdf");
   });

   it("keeps the typed destination next to the error when the replace fails", async () => {
      h.mutate.mockImplementation(
         (_input, callbacks: { onError: (error: unknown) => void }) =>
            callbacks.onError(new Error("Precondition failed"))
      );
      await open();
      await submit("reports/b.pdf");
      await press("Replace");
      expect(input().value).toBe("reports/b.pdf");
      expect(view.current.container.textContent).toContain(
         "Precondition failed"
      );
   });
});
