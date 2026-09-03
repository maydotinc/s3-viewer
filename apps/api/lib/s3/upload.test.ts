import { describe, expect, it } from "vitest";
import { declaredLength, exceedsLimit } from "./upload";

describe("declaredLength", () => {
   it("parses a well-formed Content-Length", () => {
      expect(declaredLength("0")).toBe(0);
      expect(declaredLength("1048576")).toBe(1048576);
   });

   it("is undefined when the header is missing or malformed", () => {
      expect(declaredLength(undefined)).toBeUndefined();
      expect(declaredLength("")).toBeUndefined();
      expect(declaredLength("abc")).toBeUndefined();
      expect(declaredLength("-1")).toBeUndefined();
      expect(declaredLength("1.5")).toBeUndefined();
      expect(declaredLength("1e400")).toBeUndefined();
   });
});

describe("exceedsLimit", () => {
   it("trips only when both sides are known and the size is above the cap", () => {
      expect(exceedsLimit(101, 100)).toBe(true);
      expect(exceedsLimit(100, 100)).toBe(false);
      expect(exceedsLimit(0, 100)).toBe(false);
   });

   it("never trips without a cap or without a declared size", () => {
      expect(exceedsLimit(10 ** 12, undefined)).toBe(false);
      expect(exceedsLimit(undefined, 100)).toBe(false);
      expect(exceedsLimit(undefined, undefined)).toBe(false);
   });
});
