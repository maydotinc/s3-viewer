// @vitest-environment happy-dom
import {
   act,
   createElement,
   useState,
   type ChangeEvent,
   type Dispatch,
   type SetStateAction,
} from "react";
import { mountRuntime } from "@/lib/test/runtime";
import { MAX_GRANT_FOLDERS } from "@s3-viewer/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buttonByText } from "@/components/test-helpers";
import { FolderListEditor } from "./grant-scope";

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/hooks/usePathSuggestion", () => ({
   usePathSuggestion: () => "",
}));
vi.mock("@/components/path-input", () => ({
   default: ({
      id,
      value,
      disabled,
      onChange,
   }: {
      id?: string;
      value: string;
      disabled?: boolean;
      onChange: (event: ChangeEvent<HTMLInputElement>) => void;
   }) => createElement("input", { id, value, disabled, onChange }),
}));

type State = {
   folders: string[];
   draft: string;
   error: string | null;
   showError: boolean;
};

let state: State;
let setState: Dispatch<SetStateAction<State>>;
const Row = ({ initial }: { initial: State }) => {
   const [current, set] = useState(initial);
   state = current;
   setState = set;
   return createElement(FolderListEditor, {
      serverId: "server",
      bucketName: "site",
      held: null,
      ...current,
      onChange: (change) => set((previous) => ({ ...previous, ...change })),
   });
};

let runtime: Awaited<ReturnType<typeof mountRuntime>>;
const open = async (initial: Partial<State> = {}) => {
   runtime = await mountRuntime(
      createElement(Row, {
         initial: {
            folders: [],
            draft: "",
            error: null,
            showError: false,
            ...initial,
         },
      })
   );
};
const input = () => runtime.container.querySelector("input")!;
const typeFolder = (value: string) =>
   act(async () => {
      const field = input();
      Object.getOwnPropertyDescriptor(
         HTMLInputElement.prototype,
         "value"
      )!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
   });
const add = () =>
   act(async () => buttonByText(runtime.container, "Add")!.click());
const update = (change: Partial<State>) =>
   act(async () => setState((previous) => ({ ...previous, ...change })));
const shown = () => runtime.container.textContent;

afterEach(async () => {
   await runtime.unmount();
   runtime.queryClient.clear();
   vi.unstubAllGlobals();
});

describe("the folder being typed", () => {
   it("belongs to the row, so the form can see it", async () => {
      await open();
      await typeFolder("landing");
      expect(state.draft).toBe("landing");
      expect(shown()).toContain("Press Enter or Add to add it.");
   });

   it("moves into the list in one change when added", async () => {
      await open({ folders: ["a/"] });
      await typeFolder("b");
      await add();
      expect(state).toMatchObject({ folders: ["a/", "b/"], draft: "" });
   });
});

describe("the folder chips", () => {
   it("spell out bidi characters but remove the raw folder", async () => {
      await open({ folders: ["a\u202Eb/", "c/"] });
      const chip = runtime.container.querySelector("li")!;
      expect(chip.textContent).toBe("a[U+202E]b/");
      expect(chip.querySelector("span")!.title).toBe("a[U+202E]b/");
      const remove = chip.querySelector("button")!;
      expect(remove.getAttribute("aria-label")).toBe("Remove a[U+202E]b/");
      await act(async () => remove.click());
      expect(state.folders).toEqual(["c/"]);
   });
});

describe("notes from the last add", () => {
   it("shows a note next to the row's error rather than over it", async () => {
      await open({ folders: ["a/b/", "a/c/"] });
      await typeFolder("a");
      await add();
      expect(shown()).toContain(
         "Removed a/b/ and a/c/, since a/ includes them."
      );
      await update({ error: "Check this.", showError: true });
      expect(shown()).toContain("Removed a/b/ and a/c/");
      expect(shown()).toContain("Check this.");
   });

   it("drops the note once the folders change some other way", async () => {
      await open({ folders: ["a/b/"] });
      await typeFolder("a");
      await add();
      expect(shown()).toContain("since a/ includes it");
      await update({ folders: ["z/"] });
      expect(shown()).not.toContain("since a/ includes it");
   });

   it("keeps a refused add's reason next to the row's error", async () => {
      await open({ folders: ["a/"], error: "Check this.", showError: true });
      await typeFolder("a");
      await add();
      expect(shown()).toContain("a/ is already in the list.");
      expect(shown()).toContain("Check this.");
   });
});

describe(`at ${MAX_GRANT_FOLDERS} folders`, () => {
   const full = Array.from(
      { length: MAX_GRANT_FOLDERS },
      (_, index) => `f/${String(index).padStart(2, "0")}/`
   );

   it("keeps the field open so a parent can replace what's inside it", async () => {
      await open({ folders: full });
      expect(input().disabled).toBe(false);
      await typeFolder("f");
      await add();
      expect(state.folders).toEqual(["f/"]);
   });

   it("still refuses one more folder", async () => {
      await open({ folders: full });
      await typeFolder("g");
      await add();
      expect(state.folders).toHaveLength(MAX_GRANT_FOLDERS);
      expect(shown()).toContain(
         `You can add up to ${MAX_GRANT_FOLDERS} folders.`
      );
   });
});
