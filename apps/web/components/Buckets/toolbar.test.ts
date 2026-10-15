// @vitest-environment happy-dom
import type { KnownReach } from "@/lib/utils/folder-access";
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import ObjectsToolbar from "./toolbar";

const h = vi.hoisted(() => ({
   reach: { folders: null, owner: false } as KnownReach,
   selectedIds: [] as string[],
   remove: vi.fn(),
   moveMany: vi.fn(),
   downloadZip: vi.fn(),
   toastError: vi.fn(),
}));

vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/shortcuts", () => ({ useShortcut: vi.fn() }));
vi.mock("@/lib/stores/preferences-store", () => ({
   default: (select: (state: unknown) => unknown) =>
      select({ foldersFirst: true, setFoldersFirst: vi.fn() }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({
      error: h.toastError,
   })
);
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@s3-viewer/ui/components/dropdown-menu", () => {
   const passthrough = ({ children }: { children?: ReactNode }) =>
      createElement("div", null, children);
   const item = ({
      children,
      disabled,
      onSelect,
   }: {
      children?: ReactNode;
      disabled?: boolean;
      onSelect?: () => void;
   }) => createElement("button", { disabled, onClick: onSelect }, children);
   return {
      DropdownMenu: passthrough,
      DropdownMenuContent: passthrough,
      DropdownMenuTrigger: passthrough,
      DropdownMenuLabel: passthrough,
      DropdownMenuRadioGroup: passthrough,
      DropdownMenuRadioItem: item,
      DropdownMenuItem: item,
      DropdownMenuSeparator: () => null,
   };
});
vi.mock("@/components/DataGrid/context", () => ({
   useGridPaginationContext: () => ({ rowCount: 0 }),
   useGridContext: () => ({
      selectedIds: h.selectedIds,
      selectedObjects: new Map(
         h.selectedIds.map((key) => [key, { key, eTag: '"e"', size: 1 }])
      ),
      clearSelection: vi.fn(),
   }),
}));
vi.mock("./Context", () => ({
   useBucketContext: () => ({
      bucketName: "bucket",
      prefix: "logs/",
      reach: h.reach,
      refresh: vi.fn(),
      isLoading: false,
   }),
}));
vi.mock("@/components/Buckets/Grid/prefix-search", () => ({
   default: () => null,
}));
vi.mock("@/components/Buckets/Upload/upload-menu", () => ({
   default: () => null,
}));
vi.mock("@/components/Buckets/Upload/provider", () => ({
   useUploader: () => ({ canUpload: true, blockedReason: null, notice: null }),
}));
vi.mock("./useObjectCommands", () => ({
   default: () => ({
      can: { download: true, rename: true, upload: true, delete: true },
      isResolving: false,
      isPreparingZip: false,
      remove: h.remove,
      moveMany: h.moveMany,
      downloadZip: h.downloadZip,
   }),
}));

const view = mountedRuntime();
const mount = async () => {
   await view.mount(createElement(ObjectsToolbar));
};
const click = async (label: string) => {
   const button = [...view.current.container.querySelectorAll("button")].find(
      (candidate) =>
         candidate.getAttribute("aria-label")?.startsWith(label) ||
         candidate.textContent?.includes(label)
   )!;
   await act(async () => button.click());
};

beforeEach(() => {
   vi.clearAllMocks();
   h.reach = { folders: null, owner: false };
   h.selectedIds = ["logs/a.txt", "logs/../b.txt"];
});

describe("acting on a selection with a row the caller can't act on", () => {
   it("refuses delete, move and zip with the reason instead of sending a batch the server rejects", async () => {
      await mount();
      await click("Delete");
      await click("Move");
      await click("Download zip");
      expect(h.remove).not.toHaveBeenCalled();
      expect(h.moveMany).not.toHaveBeenCalled();
      expect(h.downloadZip).not.toHaveBeenCalled();
      expect(h.toastError).toHaveBeenCalledTimes(3);
      expect(h.toastError.mock.calls[0]![0]).toContain("server owner");
   });

   it("sends the selection when every row is actionable", async () => {
      h.reach = { folders: null, owner: true };
      await mount();
      await click("Delete");
      await click("Download zip");
      expect(h.remove).toHaveBeenCalledExactlyOnceWith(
         h.selectedIds.map((key) => ({ key, expectedETag: '"e"', size: 1 })),
         expect.any(Function)
      );
      expect(h.downloadZip).toHaveBeenCalledWith(h.selectedIds);
      expect(h.toastError).not.toHaveBeenCalled();
   });
});
