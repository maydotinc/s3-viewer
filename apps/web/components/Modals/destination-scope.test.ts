// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { DOT_SEGMENTS, type KnownReach } from "@/lib/utils/folder-access";
import CreateFolderModal from "./CreateFolderModal";
import { KeyDialog } from "./key-dialog";

const h = vi.hoisted(() => ({ reach: undefined as KnownReach }));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@/lib/hooks/queries/s3/useBucketScope", () => ({
   default: () => h.reach,
}));
vi.mock("@/lib/hooks/usePathSuggestion", () => ({
   usePathSuggestion: () => "",
   isAcceptSuggestionKey: () => false,
}));
vi.mock("@/lib/hooks/mutations/object/useCreateFolder", () => ({
   default: () => ({ mutate: vi.fn(), isPending: false }),
}));

const view = mountedRuntime(() => vi.unstubAllGlobals());
const target = { userId: "user", serverId: "server", bucketName: "site" };
const mount = async (element: ReactNode) => {
   await view.mount(element);
};
const submitDisabled = () =>
   view.current.container.querySelector<HTMLButtonElement>(
      "button[type=submit]"
   )!.disabled;
const type = async (value: string) =>
   act(async () => {
      const field = view.current.container.querySelector("input")!;
      Object.getOwnPropertyDescriptor(
         HTMLInputElement.prototype,
         "value"
      )!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
   });

beforeEach(() => {
   h.reach = { folders: ["landing/"], owner: false };
});

describe("a key dialog's destination", () => {
   const open = (initialValue: string) =>
      mount(
         createElement(KeyDialog, {
            ...target,
            onClose: vi.fn(),
            title: "Move",
            description: "",
            label: "Destination",
            submitLabel: "Move",
            initialValue,
            validate: () => null,
            onSubmit: vi.fn(),
         })
      );

   it("has to be inside someone's folders", async () => {
      await open("landing/a.txt");
      expect(submitDisabled()).toBe(false);
      await type("private/a.txt");
      expect(submitDisabled()).toBe(true);
      expect(view.current.container.textContent).toContain(
         "You can only write inside landing/ in this bucket."
      );
   });

   it("can't use dot segments unless they're the owner's", async () => {
      h.reach = { folders: null, owner: false };
      await open("a/../b.txt");
      expect(submitDisabled()).toBe(true);
      h.reach = { folders: null, owner: true };
      await open("a/../b.txt");
      expect(submitDisabled()).toBe(false);
   });

   it("isn't held up while the bucket list loads", async () => {
      h.reach = undefined;
      await open("private/a.txt");
      expect(submitDisabled()).toBe(false);
   });
});

describe("a new folder", () => {
   const open = (prefix: string) =>
      mount(
         createElement(CreateFolderModal, {
            ...target,
            onClose: vi.fn(),
            prefix,
         })
      );

   it("has to land inside someone's folders", async () => {
      await open("");
      await type("invoices");
      expect(submitDisabled()).toBe(true);
      await open("landing/");
      await type("invoices");
      expect(submitDisabled()).toBe(false);
   });

   it("can't be made under a dotted path but by the owner", async () => {
      h.reach = { folders: null, owner: false };
      await open("a\\..\\b/");
      await type("x");
      expect(submitDisabled()).toBe(true);
      expect(view.current.container.textContent).toContain(DOT_SEGMENTS);
   });
});
