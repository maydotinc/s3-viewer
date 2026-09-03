import { describe, expect, it } from "vitest";
import { localPart, normalizeEmail } from "./utils";

describe("normalizeEmail", () => {
   it("trims and lowercases", () => {
      expect(normalizeEmail("  Ada@Example.COM  ")).toBe("ada@example.com");
   });
});

describe("localPart", () => {
   it("returns the part before the @", () => {
      expect(localPart("ada@example.com")).toBe("ada");
      expect(localPart("first.last+tag@example.co.uk")).toBe("first.last+tag");
   });

   it("trims surrounding whitespace", () => {
      expect(localPart("  ada@example.com ")).toBe("ada");
   });

   it("falls back to the whole value without a usable local part", () => {
      expect(localPart("nolocal")).toBe("nolocal");
      expect(localPart("@example.com")).toBe("@example.com");
   });
});
