import { describe, expect, it } from "vitest";
import {
   applyLineEnding,
   dominantLineEnding,
   isSaveShortcut,
   toEditorText,
} from "./editor-input";

const key = (
   text: string,
   modifiers: { metaKey?: boolean; ctrlKey?: boolean } = {}
) => ({ key: text, metaKey: false, ctrlKey: false, ...modifiers });

describe("line endings of an edited file", () => {
   it.each([
      ["one\r\ntwo\r\nthree", "\r\n"],
      ["one\ntwo\nthree", "\n"],
      ["one line", "\n"],
      ["", "\n"],
      ["one\r\ntwo\r\nthree\nfour", "\r\n"],
      ["one\ntwo\nthree\r\nfour", "\n"],
   ])("reads %j as %j", (text, ending) => {
      expect(dominantLineEnding(text)).toBe(ending);
   });

   it("writes a windows file back with the endings it arrived with", () => {
      const loaded = "one\r\ntwo\r\n";
      const edited = `${toEditorText(loaded)}three\n`;
      expect(applyLineEnding(edited, dominantLineEnding(loaded))).toBe(
         "one\r\ntwo\r\nthree\r\n"
      );
   });

   it("never doubles a carriage return", () => {
      expect(applyLineEnding("one\r\ntwo", "\r\n")).toBe("one\r\ntwo");
   });
});

describe("the save shortcut", () => {
   it.each([
      key("s", { metaKey: true }),
      key("s", { ctrlKey: true }),
      key("S", { metaKey: true }),
   ])("saves on %o", (event) => {
      expect(isSaveShortcut(event)).toBe(true);
   });

   it.each([
      key("s"),
      key("a", { metaKey: true }),
      key("Shift", { ctrlKey: true }),
   ])("ignores %o", (event) => {
      expect(isSaveShortcut(event)).toBe(false);
   });
});
