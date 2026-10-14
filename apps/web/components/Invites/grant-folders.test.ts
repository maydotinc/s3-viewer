import { MAX_GRANT_FOLDERS } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   addGrantFolder,
   editorMessages,
   feedbackFor,
   folderInputError,
   hintFor,
   normalizeFolderInput,
} from "./grant-folders";

describe("typing a folder", () => {
   it.each([
      ["landing", "landing/"],
      ["/landing", "landing/"],
      ["landing/", "landing/"],
      ["//landing/", "landing/"],
      ["  landing  ", "landing/"],
      ["blog/images", "blog/images/"],
      ["", ""],
   ])("normalizes %j to %j", (raw, folder) => {
      expect(normalizeFolderInput(raw)).toBe(folder);
   });

   it.each(["my folder/", "café/menüs/", "100%/", "a+b/", "%2F/", "日本語/"])(
      "keeps %j exactly as typed",
      (folder) => {
         expect(normalizeFolderInput(folder)).toBe(folder);
         expect(folderInputError(folder)).toBeNull();
      }
   );

   it.each([
      ["", "Enter a folder name."],
      ["a//b/", 'A folder can\'t have empty, "." or ".." parts.'],
      ["a/./", 'A folder can\'t have empty, "." or ".." parts.'],
      ["a/../b/", 'A folder can\'t have empty, "." or ".." parts.'],
      ["a\\..\\b/", 'A folder can\'t have empty, "." or ".." parts.'],
      ["a\tb/", "A folder can't contain control characters."],
      [`${"é".repeat(512)}/`, "A folder can be at most 1,024 bytes long."],
      ["\u200b/", "A folder can't have parts with no visible characters."],
      [
         "a/\u200b\u2060/",
         "A folder can't have parts with no visible characters.",
      ],
      ["\u3164/", "A folder can't have parts with no visible characters."],
      ["\u00a0 /", "A folder can't have parts with no visible characters."],
   ])("explains why %j isn't a folder", (folder, error) => {
      expect(folderInputError(folder)).toBe(error);
   });
});

describe("adding a folder to a grant", () => {
   it("normalizes and sorts what was typed", () => {
      expect(addGrantFolder(["landing/"], "/blog", null)).toEqual({
         ok: true,
         folder: "blog/",
         folders: ["blog/", "landing/"],
         replaced: [],
         notice: null,
      });
   });

   it("refuses a folder already in the list", () => {
      expect(addGrantFolder(["landing/"], "landing", null)).toEqual({
         ok: false,
         error: "landing/ is already in the list.",
      });
   });

   it("narrows a broader folder in the list and says so", () => {
      expect(addGrantFolder(["landing/", "z/"], "landing/hero", null)).toEqual({
         ok: true,
         folder: "landing/hero/",
         folders: ["landing/hero/", "z/"],
         replaced: ["landing/"],
         notice:
            "Replaced landing/ with landing/hero/, so only landing/hero/ is shared.",
      });
   });

   it("collapses the folders a new parent covers and says so", () => {
      expect(addGrantFolder(["a/b/", "a/c/", "z/"], "a", null)).toEqual({
         ok: true,
         folder: "a/",
         folders: ["a/", "z/"],
         replaced: ["a/b/", "a/c/"],
         notice: "Removed a/b/ and a/c/, since a/ includes them.",
      });
   });

   it("keeps an actor limited to folders inside them", () => {
      expect(addGrantFolder([], "private", ["landing/"])).toEqual({
         ok: false,
         error: "You can only share folders inside landing/.",
      });
      expect(addGrantFolder([], "landing/hero", ["landing/"])).toMatchObject({
         ok: true,
         folders: ["landing/hero/"],
      });
   });

   it(`stops at ${MAX_GRANT_FOLDERS} folders, counted after merging`, () => {
      const full = Array.from(
         { length: MAX_GRANT_FOLDERS },
         (_, index) => `f/${String(index).padStart(2, "0")}/`
      );
      expect(addGrantFolder(full, "zz", null)).toEqual({
         ok: false,
         error: `You can add up to ${MAX_GRANT_FOLDERS} folders.`,
      });
      expect(addGrantFolder(full, "f", null)).toMatchObject({
         ok: true,
         folders: ["f/"],
      });
      expect(addGrantFolder(full, "f/03/deep", null)).toMatchObject({
         ok: true,
         replaced: ["f/03/"],
      });
   });

   it("spells out bidi and zero-width characters in what it says", () => {
      expect(addGrantFolder(["a\u202Eb/"], "a\u202Eb", null)).toEqual({
         ok: false,
         error: "a[U+202E]b/ is already in the list.",
      });
      expect(addGrantFolder(["x/"], "y", ["x\u200B/"])).toEqual({
         ok: false,
         error: "You can only share folders inside x[U+200B]/.",
      });
      expect(
         addGrantFolder(["a\u202E/"], "a\u202E/b\u2066", null)
      ).toMatchObject({
         ok: true,
         folder: "a\u202E/b\u2066/",
         replaced: ["a\u202E/"],
         notice:
            "Replaced a[U+202E]/ with a[U+202E]/b[U+2066]/, so only a[U+202E]/b[U+2066]/ is shared.",
      });
      expect(addGrantFolder(["a/\u200Fb/", "a/c/"], "a", null)).toMatchObject({
         notice: "Removed a/[U+200F]b/ and a/c/, since a/ includes them.",
      });
      expect(
         hintFor({
            folders: [],
            draft: "",
            held: ["\u202Ex/"],
            hasSuggestion: false,
         })
      ).toBe("Inside [U+202E]x/ only. A folder doesn't have to exist yet.");
   });

   it("passes on invalid input", () => {
      expect(addGrantFolder([], "a/../b", null)).toEqual({
         ok: false,
         error: 'A folder can\'t have empty, "." or ".." parts.',
      });
   });
});

describe("what shows under the folder field", () => {
   const hint = (
      folders: string[],
      draft = "",
      held: string[] | null = null,
      hasSuggestion = false
   ) => hintFor({ folders, draft, held, hasSuggestion });

   it("says how to add what was typed", () => {
      expect(hint([], "landing")).toBe("Press Enter or Add to add it.");
      expect(hint([], "land", null, true)).toBe(
         "→ to autocomplete. Press Enter or Add to add it."
      );
      expect(hint([])).toBe("A folder doesn't have to exist yet.");
   });

   it("tells a limited sharer where they can share up front", () => {
      expect(hint([], "", ["landing/"])).toBe(
         "Inside landing/ only. A folder doesn't have to exist yet."
      );
   });

   it("keeps the field open at the limit, since a parent can merge", () => {
      const full = Array.from({ length: MAX_GRANT_FOLDERS }, (_, i) => `${i}/`);
      expect(hint(full)).toBe(
         `That's the limit of ${MAX_GRANT_FOLDERS} folders. A parent folder can still replace the ones inside it.`
      );
   });

   const messages = (
      overrides: Partial<Parameters<typeof editorMessages>[0]> = {}
   ) =>
      editorMessages({
         feedback: null,
         folders: ["a/"],
         draft: "",
         error: null,
         showError: false,
         hint: "hint",
         ...overrides,
      });

   it("shows the hint when nothing else needs saying", () => {
      expect(messages()).toEqual([{ tone: "notice", text: "hint" }]);
   });

   it("shows a note and the row's error together", () => {
      expect(
         messages({
            feedback: feedbackFor("notice", "Removed b/.", ["a/"]),
            error: "Check this.",
            showError: true,
         })
      ).toEqual([
         { tone: "notice", text: "Removed b/." },
         { tone: "error", text: "Check this." },
      ]);
   });

   it("drops a note once the folders it was about have changed", () => {
      const note = feedbackFor("notice", "Removed b/.", ["a/"]);
      expect(
         messages({
            feedback: note,
            folders: ["a/", "c/"],
            error: "Check this.",
            showError: true,
         })
      ).toEqual([{ tone: "error", text: "Check this." }]);
      expect(messages({ feedback: note, folders: [] })).toEqual([
         { tone: "notice", text: "hint" },
      ]);
   });

   it("prefers how-to-add over a quiet reminder while typing", () => {
      expect(
         messages({ folders: [], error: "Add at least one.", draft: "a" })
      ).toEqual([{ tone: "notice", text: "hint" }]);
      expect(messages({ folders: [], error: "Add at least one." })).toEqual([
         { tone: "notice", text: "Add at least one." },
      ]);
   });
});
