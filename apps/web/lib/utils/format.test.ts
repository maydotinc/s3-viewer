import { describe, expect, it } from "vitest";
import { formatBytes, joinSentences, visibleText } from "./format";

describe("formatting sizes", () => {
   it.each([
      [0, "0 B"],
      [1023, "1023 B"],
      [1024, "1.0 KiB"],
      [1024 ** 2 - 1, "1.0 MiB"],
      [5 * 1024 ** 4, "5.0 TiB"],
      [5 * 1024 ** 5, "5120 TiB"],
   ])("shows %d bytes as %s", (bytes, label) => {
      expect(formatBytes(bytes)).toBe(label);
   });

   it("has no size for missing or impossible values", () => {
      for (const bytes of [null, undefined, -1, Number.NaN, Infinity])
         expect(formatBytes(bytes)).toBe("—");
   });
});

describe("joining messages", () => {
   it("closes an API message before the next sentence", () => {
      expect(
         joinSentences(
            "Your access to this bucket is limited to landing/",
            "Deletion is incomplete"
         )
      ).toBe(
         "Your access to this bucket is limited to landing/. Deletion is incomplete."
      );
   });

   it("leaves finished sentences and skips empty parts", () => {
      expect(
         joinSentences("Copied 3…", null, "", undefined, false, "Done!")
      ).toBe("Copied 3… Done!");
      expect(joinSentences("These failed:", "  a.txt ")).toBe(
         "These failed: a.txt."
      );
      expect(joinSentences()).toBe("");
   });
});

describe("visible key text", () => {
   it.each([
      [
         "right-to-left override",
         "invoice\u202Efdp.exe",
         "invoice[U+202E]fdp.exe",
      ],
      ["newline", "a\nb", "a[U+000A]b"],
   ])("spells out a %s", (_label, key, shown) => {
      expect(visibleText(key)).toBe(shown);
   });

   it("leaves a joined emoji alone", () => {
      expect(visibleText("Ops 👨‍👩‍👧 team")).toBe("Ops 👨‍👩‍👧 team");
   });
});
