// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   mountedRuntime,
   submitForm,
   typeInto,
} from "@/components/test-helpers";
import { INPUT_DEBOUNCE_MS } from "@/lib/constants";
import type { BulkRenameSource } from "@/lib/contexts/modal-sources";
import type {
   MoveSummary,
   MoveTarget,
} from "@/lib/hooks/mutations/object/useMoveObjects";
import type { S3DeleteTarget } from "@s3-viewer/types";
import Modal from "./index";

const h = vi.hoisted(() => ({
   collect: vi.fn(),
   existing: vi.fn(),
   move: vi.fn(),
   summary: {
      done: 0,
      failed: [] as MoveSummary["failed"],
      unsent: [],
      listingError: null,
      remaining: false,
      aborted: false,
   } as MoveSummary,
}));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@s3-viewer/ui/components/select", () => ({
   Select: ({
      value,
      disabled,
      onValueChange,
      children,
   }: {
      value: string;
      disabled?: boolean;
      onValueChange: (value: string) => void;
      children?: ReactNode;
   }) =>
      createElement(
         "select",
         {
            value,
            disabled,
            onChange: (event: { target: { value: string } }) =>
               onValueChange(event.target.value),
         },
         children
      ),
   SelectTrigger: () => null,
   SelectValue: () => null,
   SelectContent: ({ children }: { children?: ReactNode }) => children,
   SelectItem: ({ value, children }: { value: string; children?: ReactNode }) =>
      createElement("option", { value }, children),
}));
vi.mock("@/components/Modals/deletion-protection-notice", () => ({
   default: () => null,
}));
vi.mock("./plan", () => ({
   collectSources: h.collect,
   findExisting: h.existing,
}));
vi.mock("@/lib/hooks/mutations/object/useMoveObjects", () => ({
   default: () => ({
      isPending: false,
      mutate: (
         input: { objects: MoveTarget[] },
         callbacks: { onSuccess: (summary: MoveSummary) => void }
      ) => {
         h.move(input);
         callbacks.onSuccess(h.summary);
      },
   }),
}));

const onClose = vi.fn();
const view = mountedRuntime(() => vi.useRealTimers());
const submitButton = () =>
   view.current.container.querySelector<HTMLButtonElement>(
      "button[type=submit]"
   )!;
const flush = () =>
   act(async () => {
      await vi.advanceTimersByTimeAsync(INPUT_DEBOUNCE_MS);
   });
const target = (key: string): S3DeleteTarget => ({
   key,
   expectedETag: `"${key}"`,
});
const folder: BulkRenameSource = { folderKey: "photos/" };
const listed = (keys: string[], truncated = false) =>
   h.collect.mockResolvedValue({ objects: keys.map(target), truncated });
const open = async () => {
   await view.mount(
      createElement(Modal, {
         onClose,
         userId: "user1",
         serverId: "server1",
         bucketName: "bucket",
         source: folder,
      })
   );
   await flush();
};
const type = (label: string, value: string) => {
   const field = [...view.current.container.querySelectorAll("label")].find(
      (candidate) => candidate.textContent === label
   )!;
   typeInto(document.getElementById(field.htmlFor) as HTMLInputElement, value);
};
const enter = async (label: string, value: string) => {
   await act(async () => type(label, value));
   await flush();
};
const choose = async (kind: string) => {
   await act(async () => {
      const select = view.current.container.querySelector("select")!;
      select.value = kind;
      select.dispatchEvent(new Event("change", { bubbles: true }));
   });
   await flush();
};
const submit = async () => {
   await act(async () => submitForm(view.current.container));
   await flush();
};

beforeEach(() => {
   vi.clearAllMocks();
   vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
   h.summary = {
      done: 0,
      failed: [],
      unsent: [],
      listingError: null,
      remaining: false,
      aborted: false,
   };
   h.collect.mockReset();
   h.existing.mockReset().mockResolvedValue([]);
   h.move.mockReset();
   listed(["photos/DRAFT one.txt", "photos/DRAFT two.txt", "photos/keep.md"]);
});

describe("bulk rename planning", () => {
   it("lists the objects once and plans against that snapshot", async () => {
      await open();
      expect(h.collect.mock.calls[0]?.[0].targets).toEqual([
         { key: "photos/", expectedETag: null },
      ]);
      expect(view.text()).toContain("3 objects in scope");
      expect(submitButton().disabled).toBe(true);
      const listings = h.collect.mock.calls.length;
      await enter("Find", "DRAFT");
      expect(h.collect).toHaveBeenCalledTimes(listings);
   });

   it("skips the rows an operation leaves alone", async () => {
      await open();
      await enter("Find", "DRAFT");
      await enter("Replace with", "final");
      expect(submitButton().textContent).toBe("Rename 2");
      expect(submitButton().disabled).toBe(false);
      expect(view.text()).toContain("1 unchanged and skipped");
   });

   it("plans against the last keystroke, not the first", async () => {
      await open();
      await enter("Find", "DRAFT");
      await act(async () => {
         type("Replace with", "fin");
         type("Replace with", "final");
      });
      await flush();
      expect(view.text()).toContain("photos/final one.txt");
      expect(view.text()).not.toContain("photos/fin one.txt");
   });

   it("blocks a plan where two objects would claim one name", async () => {
      listed(["photos/Report.csv", "photos/REPORT.csv"]);
      await open();
      await choose("lowercase");
      expect(submitButton().disabled).toBe(true);
      expect(view.text()).toContain("claimed by more than one object");
      await submit();
      expect(h.move).not.toHaveBeenCalled();
   });

   it("blocks a target another row of the batch is renaming away", async () => {
      listed(["photos/a.txt", "photos/xa.txt"]);
      await open();
      await choose("prefix");
      await enter("Prefix", "x");
      expect(submitButton().disabled).toBe(true);
      expect(view.text()).toContain("Ordering conflict");
      expect(view.text()).toContain("photos/xa.txt");
      await submit();
      expect(h.move).not.toHaveBeenCalled();
   });

   it("refuses a target that is not a usable key", async () => {
      await open();
      await choose("prefix");
      await enter("Prefix", "../");
      expect(submitButton().disabled).toBe(true);
      expect(view.text()).toContain("unusable key");
   });

   it("stops on a folder too large to review in one pass", async () => {
      listed(["photos/one.txt"], true);
      await open();
      expect(submitButton().disabled).toBe(true);
      expect(view.text()).toContain("Open a subfolder");
   });
});

describe("bulk rename execution", () => {
   const prepared = async () => {
      await open();
      await enter("Find", "DRAFT");
      await enter("Replace with", "final");
   };
   const failure = (name: string, message: string, retryable = true) => ({
      key: `photos/DRAFT ${name}.txt`,
      newKey: `photos/final ${name}.txt`,
      expectedETag: null,
      message,
      retryable,
   });

   it("checks the destinations before moving anything", async () => {
      h.existing.mockResolvedValue(["photos/final one.txt"]);
      await prepared();
      await submit();
      expect(h.move).not.toHaveBeenCalled();
      expect(view.text()).toContain("already exist");
   });

   it("moves the planned pairs with the etags from the listing", async () => {
      h.summary = { ...h.summary, done: 2 };
      await prepared();
      await submit();
      expect(h.move).toHaveBeenCalledOnce();
      expect(h.move.mock.calls[0]?.[0].objects).toEqual([
         {
            key: "photos/DRAFT one.txt",
            newKey: "photos/final one.txt",
            expectedETag: '"photos/DRAFT one.txt"',
         },
         {
            key: "photos/DRAFT two.txt",
            newKey: "photos/final two.txt",
            expectedETag: '"photos/DRAFT two.txt"',
         },
      ]);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("retries only the failures a second run could fix", async () => {
      h.summary = {
         ...h.summary,
         done: 1,
         failed: [failure("two", "Access denied")],
      };
      await prepared();
      await submit();
      expect(onClose).not.toHaveBeenCalled();
      expect(submitButton().textContent).toBe("Continue renaming");
      h.summary = { ...h.summary, failed: [] };
      h.existing
         .mockReset()
         .mockResolvedValueOnce(["photos/DRAFT two.txt"])
         .mockResolvedValue([]);
      await submit();
      expect(h.move.mock.calls[1]?.[0].objects).toEqual([
         {
            key: "photos/DRAFT two.txt",
            newKey: "photos/final two.txt",
            expectedETag: '"photos/DRAFT two.txt"',
         },
      ]);
      expect(view.text()).toContain("Renamed 2");
   });

   it("locks the pattern once a run was attempted, so a retry resends what the preview showed", async () => {
      h.summary = {
         ...h.summary,
         done: 1,
         failed: [failure("two", "Access denied")],
      };
      await prepared();
      await submit();
      const controls = [
         ...view.current.container.querySelectorAll<
            HTMLInputElement | HTMLSelectElement | HTMLButtonElement
         >("input, select, button[role=checkbox]"),
      ];
      expect(controls.length).toBeGreaterThan(2);
      expect(controls.every((control) => control.disabled)).toBe(true);
      expect(submitButton().disabled).toBe(false);
   });

   it("resends what a cancel left unsent alongside the retryable failures", async () => {
      h.summary = {
         ...h.summary,
         failed: [failure("one", "Cancelled")],
         unsent: [failure("two", "Cancelled")],
         aborted: true,
         remaining: true,
      };
      await prepared();
      await submit();
      expect(onClose).not.toHaveBeenCalled();
      h.existing
         .mockReset()
         .mockResolvedValueOnce([
            "photos/DRAFT one.txt",
            "photos/DRAFT two.txt",
         ])
         .mockResolvedValue([]);
      await submit();
      expect(
         h.move.mock.calls[1]?.[0].objects.map(({ key }: MoveTarget) => key)
      ).toEqual(["photos/DRAFT one.txt", "photos/DRAFT two.txt"]);
   });

   it("drops the sources an earlier run already renamed", async () => {
      h.summary = {
         ...h.summary,
         failed: [failure("one", "Access denied")],
      };
      await prepared();
      await submit();
      h.existing.mockReset().mockResolvedValue([]);
      await submit();
      expect(h.move).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("blocks a rerun once only unreviewable failures are left", async () => {
      h.summary = {
         ...h.summary,
         failed: [failure("one", "Storage did not confirm the move.", false)],
      };
      await prepared();
      await submit();
      expect(submitButton().disabled).toBe(true);
      expect(view.text()).toContain("reviewed again");
      await submit();
      expect(h.move).toHaveBeenCalledOnce();
   });
});
