import { describe, expect, it } from "vitest";
import { textDigest } from "./digest";

describe("textDigest", () => {
   it("is stable for equal input", () => {
      expect(textDigest("a\nb")).toBe(textDigest("a\nb"));
   });

   it("separates lists that differ by order, content or length", () => {
      const digests = new Set(
         ["a\nb", "b\na", "a\nc", "a\nb\n", "", "a"].map(textDigest)
      );
      expect(digests.size).toBe(6);
   });

   it("stays short for a maximal key list", () => {
      const keys = Array.from({ length: 20_000 }, (_, i) => `key-${i}`);
      expect(textDigest(keys.join("\n")).length).toBeLessThan(24);
   });
});
