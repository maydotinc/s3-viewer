import { describe, expect, it } from "vitest";
import {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   partSizeFor,
} from "./upload";

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

describe("partSizeFor", () => {
   const basePartBytes = 25 * 1024 * 1024;

   it("uses the base part size when the length is unknown or small", () => {
      expect(partSizeFor(undefined, basePartBytes)).toBe(basePartBytes);
      expect(partSizeFor(1024, basePartBytes)).toBe(basePartBytes);
   });

   it("grows the part size so a large declared length stays under MAX_PARTS parts", () => {
      const contentLength = basePartBytes * MAX_PARTS + 1;
      const partSize = partSizeFor(contentLength, basePartBytes);
      expect(partSize).toBeGreaterThan(basePartBytes);
      expect(Math.ceil(contentLength / partSize)).toBeLessThanOrEqual(
         MAX_PARTS
      );
   });
});

describe("exceedsMaxPartSize", () => {
   const maxPartBytes = 100 * 1024 * 1024;

   it("is false when the length is unknown or fits under MAX_PARTS at the max part size", () => {
      expect(exceedsMaxPartSize(undefined, maxPartBytes)).toBe(false);
      expect(exceedsMaxPartSize(maxPartBytes * MAX_PARTS, maxPartBytes)).toBe(
         false
      );
   });

   it("is true when even the max part size can't fit the length under MAX_PARTS parts", () => {
      expect(
         exceedsMaxPartSize(maxPartBytes * MAX_PARTS + 1, maxPartBytes)
      ).toBe(true);
   });

   it("is true past S3's per-object limit even when parts would still fit", () => {
      const generousMaxPartBytes = 5 * 1024 * 1024 * 1024;
      expect(exceedsMaxPartSize(MAX_OBJECT_BYTES, generousMaxPartBytes)).toBe(
         false
      );
      expect(
         exceedsMaxPartSize(MAX_OBJECT_BYTES + 1, generousMaxPartBytes)
      ).toBe(true);
   });
});
