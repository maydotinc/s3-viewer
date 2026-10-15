// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import ObjectHeader from "./header";

const h = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("next/router", () => ({
   useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
   default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({ isLoading: false }),
}));
vi.mock("@/components/Buckets/useObjectCommands", () => ({
   default: () => ({
      can: { download: false, rename: false, upload: false, delete: true },
      isPreparingZip: false,
      remove: h.remove,
   }),
}));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@s3-viewer/ui/components/dropdown-menu", () => {
   const none = () => null;
   return {
      DropdownMenu: none,
      DropdownMenuContent: none,
      DropdownMenuItem: none,
      DropdownMenuSeparator: none,
      DropdownMenuTrigger: none,
   };
});

const view = mountedRuntime();
const mount = async (eTag: string | null, metadataPending: boolean) => {
   await view.mount(
      createElement(ObjectHeader, {
         bucketName: "bucket",
         objectKey: "logs/app.log",
         path: ["logs", "app.log"],
         eTag,
         metadataPending,
         canEdit: false,
         editing: false,
         onEdit: () => {},
      })
   );
};
const deleteButton = () =>
   buttonByText(view.current.container, "Delete", "includes")!;

beforeEach(() => vi.clearAllMocks());

describe("deleting from the object page", () => {
   it("waits for the object's ETag while its metadata is still loading", async () => {
      await mount(null, true);
      expect(deleteButton().disabled).toBe(true);
      deleteButton().click();
      expect(h.remove).not.toHaveBeenCalled();
   });

   it("sends the loaded ETag as the delete precondition", async () => {
      await mount('"reviewed"', false);
      expect(deleteButton().disabled).toBe(false);
      deleteButton().click();
      expect(h.remove).toHaveBeenCalledExactlyOnceWith(
         [{ key: "logs/app.log", expectedETag: '"reviewed"' }],
         expect.any(Function)
      );
   });

   it("still deletes by key when the metadata request failed", async () => {
      await mount(null, false);
      expect(deleteButton().disabled).toBe(false);
      deleteButton().click();
      expect(h.remove).toHaveBeenCalledExactlyOnceWith(
         [{ key: "logs/app.log", expectedETag: null }],
         expect.any(Function)
      );
   });
});
