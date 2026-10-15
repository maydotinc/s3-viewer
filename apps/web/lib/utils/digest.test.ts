import { describe, expect, it } from "vitest";
import { textDigest } from "./digest";

describe("textDigest", () => {
   it("separates lists that differ by order, content or length", () => {
      const digests = new Set(
         ["a\nb", "b\na", "a\nc", "a\nb\n", "", "a"].map(textDigest)
      );
      expect(digests.size).toBe(6);
   });
});
