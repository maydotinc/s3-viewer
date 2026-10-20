import { describe, expect, it } from "vitest";
import { MAX_EDIT_BYTES } from "@s3-viewer/types";
import { isEditableObject } from "./editable";

describe("which objects the inline editor opens", () => {
   it.each([
      ["notes.txt", "text/plain"],
      ["config.json", "application/json"],
      ["logo.svg", "image/svg+xml"],
      [".env", "application/octet-stream"],
   ])("opens %s served as %s", (key, contentType) =>
      expect(isEditableObject(contentType, key, 1024)).toBe(true)
   );

   it.each([
      ["photo.png", "image/png"],
      ["archive.zip", "application/zip"],
      ["blob", "application/octet-stream"],
   ])("leaves %s served as %s alone", (key, contentType) =>
      expect(isEditableObject(contentType, key, 1024)).toBe(false)
   );

   it("refuses anything past the edit limit", () => {
      expect(isEditableObject("text/plain", "big.txt", MAX_EDIT_BYTES)).toBe(
         true
      );
      expect(
         isEditableObject("text/plain", "big.txt", MAX_EDIT_BYTES + 1)
      ).toBe(false);
   });

   it.each([null, undefined])("refuses an unknown size: %s", (size) =>
      expect(isEditableObject("text/plain", "notes.txt", size)).toBe(false)
   );
});

it.each(["a//b.txt", "./file.txt", "/file.txt", "bad\tname.txt"])(
   "does not offer editing when uploads cannot preserve %j",
   (key) => {
      expect(isEditableObject("text/plain", key, 10)).toBe(false);
   }
);
