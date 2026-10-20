// @vitest-environment happy-dom
import { act, createElement, useState, type ChangeEvent } from "react";
import { MAX_GRANT_FOLDERS, Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import {
   buttonByText,
   mountedRuntime,
   typeInto,
} from "@/components/test-helpers";
import GrantScope, { FolderListEditor } from "./grant-scope";

const env = vi.hoisted(() => ({ hasLanding: false }));
vi.mock("@/lib/env", () => ({ publicEnv: env }));
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
const Row = ({ initial }: { initial: State }) => {
   const [current, set] = useState(initial);
   state = current;
   return createElement(FolderListEditor, {
      serverId: "server",
      bucketName: "site",
      ...current,
      onChange: (change) => set((previous) => ({ ...previous, ...change })),
   });
};

const view = mountedRuntime();
const open = async (initial: Partial<State> = {}) => {
   await view.mount(
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
const input = () => view.current.container.querySelector("input")!;
const typeFolder = (value: string) => act(async () => typeInto(input(), value));
const add = () =>
   act(async () => buttonByText(view.current.container, "Add")!.click());

describe("the folder being typed", () => {
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
      const chip = view.current.container.querySelector("li")!;
      expect(chip.textContent).toBe("a[U+202E]b/");
      expect(chip.querySelector("span")!.title).toBe("a[U+202E]b/");
      const remove = chip.querySelector("button")!;
      expect(remove.getAttribute("aria-label")).toBe("Remove a[U+202E]b/");
      await act(async () => remove.click());
      expect(state.folders).toEqual(["c/"]);
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
});

describe("the folder guide link", () => {
   const scope = () =>
      view.mount(
         createElement(GrantScope, {
            serverId: "server",
            entry: { bucketName: "site", role: Role.EDITOR, folders: [] },
            error: null,
            showError: false,
            onChange: vi.fn(),
         })
      );
   const guide = () =>
      view.current.container.querySelector('a[href^="/how-to/"]');

   it("links to the landing guide when the landing site is served", async () => {
      env.hasLanding = true;
      await scope();
      expect(guide()).not.toBeNull();
   });

   it("is left out without a landing site, where the page would 404", async () => {
      env.hasLanding = false;
      await scope();
      expect(guide()).toBeNull();
   });
});
