// @vitest-environment happy-dom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import CodeEditor, { type CodeEditorProps } from "./code-editor";
import type { EditorLanguage } from "./editor-language";

const runtime = mountedRuntime();
let setReadOnly!: (value: boolean) => void;
let setLanguage!: (value: EditorLanguage) => void;
const onChange = vi.fn();
const initial: CodeEditorProps = {
   value: '{"enabled": true}',
   language: "json",
   readOnly: false,
   label: "Contents of config.json",
   lineEnding: "CRLF",
   onChange,
   onLanguageChange: () => {},
};
const Harness = ({ text = initial.value }: { text?: string }) => {
   const [value, setValue] = useState(text);
   const [readOnly, setReadonlyState] = useState(false);
   const [language, setLanguageState] = useState<EditorLanguage>("json");
   setReadOnly = setReadonlyState;
   setLanguage = setLanguageState;
   return createElement(CodeEditor, {
      ...initial,
      value,
      language,
      readOnly,
      onChange: (text) => {
         setValue(text);
         onChange(text);
      },
      onLanguageChange: setLanguageState,
   });
};
const editor = () =>
   EditorView.findFromDOM(
      runtime.current.container.querySelector(".cm-editor")!
   )!;
const replace = (text: string) =>
   act(async () => {
      const view = editor();
      view.dispatch({
         changes: { from: 0, to: view.state.doc.length, insert: text },
      });
   });
const waitFor = async (text: string) => {
   await vi.waitFor(
      async () => {
         await act(async () => {});
         expect(runtime.text()).toContain(text);
      },
      { timeout: 3000 }
   );
};

beforeEach(() => {
   onChange.mockClear();
});

describe("code editor interactions", () => {
   it("highlights code, checks edits, and opens positioned diagnostics", async () => {
      await runtime.mount(createElement(Harness));
      await waitFor("No syntax issues");
      expect(
         runtime.current.container.querySelector(".cm-line span")
      ).not.toBeNull();
      expect(editor().contentDOM.getAttribute("aria-label")).toBe(
         initial.label
      );
      await replace('{"enabled":}');
      await waitFor("syntax issue");
      await act(async () =>
         buttonByText(
            runtime.current.container,
            "syntax issue",
            "includes"
         )!.click()
      );
      expect(
         runtime.current.container.querySelector(".cm-panel-lint")?.textContent
      ).toContain("Unexpected syntax");
      await replace('{"enabled": false}');
      await waitFor("No syntax issues");
      expect(onChange).toHaveBeenLastCalledWith('{"enabled": false}');
   });

   it("retains text, selection, and undo when changing language or wrap", async () => {
      await runtime.mount(createElement(Harness));
      await waitFor("No syntax issues");
      await replace("const count: number = 1;");
      await act(async () => {
         editor().dispatch({ selection: { anchor: 6 } });
         setLanguage("typescript");
      });
      await waitFor("No syntax issues");
      const wrap = runtime.current.container.querySelector<HTMLButtonElement>(
         '[aria-label="Word wrap"]'
      )!;
      await act(async () => wrap.click());
      expect(wrap.getAttribute("aria-pressed")).toBe("true");
      expect(editor().state.doc.toString()).toBe("const count: number = 1;");
      expect(editor().state.selection.main.head).toBe(6);
      expect(runtime.text()).toContain("Ln 1, Col 7");
      await act(async () => {
         undo(editor());
      });
      expect(editor().state.doc.toString()).toBe(initial.value);
   });

   it("opens find/replace and keeps the editor focusable while saving", async () => {
      await runtime.mount(createElement(Harness));
      await act(async () =>
         runtime.current.container
            .querySelector<HTMLButtonElement>(
               '[aria-label="Find and replace"]'
            )!
            .click()
      );
      expect(
         runtime.current.container.querySelector(
            '.cm-search input[name="search"]'
         )
      ).not.toBeNull();
      expect(
         runtime.current.container.querySelector(
            '.cm-search input[name="replace"]'
         )
      ).not.toBeNull();
      await act(async () => setReadOnly(true));
      expect(editor().state.facet(EditorState.readOnly)).toBe(true);
      expect(editor().contentDOM.getAttribute("contenteditable")).toBe("true");
   });

   it("clears old diagnostics when switching to a format with highlighting only", async () => {
      await runtime.mount(createElement(Harness, { text: "{" }));
      await waitFor("syntax issue");
      await act(async () => setLanguage("markdown"));
      await waitFor("No syntax checker");
      expect(runtime.text()).not.toContain("syntax issue");
      expect(editor().state.doc.toString()).toBe("{");
   });

   it("pauses and resumes analysis without altering large drafts", async () => {
      await runtime.mount(createElement(Harness));
      await waitFor("No syntax issues");
      const text = "\n".repeat(10_000);
      await replace(text);
      await waitFor("Syntax analysis paused for large file");
      expect(editor().state.doc.toString()).toBe(text);
      await replace("{}");
      await waitFor("No syntax issues");
   });
});
