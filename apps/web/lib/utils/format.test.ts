import { describe, expect, it } from "vitest";
import { formatBytes, pluralize } from "./format";

const DASH = "—";

describe("formatBytes", () => {
   it("returns the em-dash sentinel for anything that isn't a size", () => {
      expect(formatBytes(null)).toBe(DASH);
      expect(formatBytes(undefined)).toBe(DASH);
      expect(formatBytes(NaN)).toBe(DASH);
      expect(formatBytes(Infinity)).toBe(DASH);
      expect(formatBytes(-Infinity)).toBe(DASH);
      expect(formatBytes(-1)).toBe(DASH);
      expect(formatBytes(-1024)).toBe(DASH);
   });

   it("formats zero and sub-byte values in bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(0.5)).toBe("1 B");
      expect(formatBytes(1)).toBe("1 B");
      expect(formatBytes(1023)).toBe("1023 B");
   });

   it("labels the binary units it divides by", () => {
      expect(formatBytes(1024)).toBe("1.0 KiB");
      expect(formatBytes(1024 ** 2)).toBe("1.0 MiB");
      expect(formatBytes(1024 ** 3)).toBe("1.0 GiB");
      expect(formatBytes(1024 ** 4)).toBe("1.0 TiB");
   });

   it("keeps one decimal below ten and drops it above", () => {
      expect(formatBytes(1536)).toBe("1.5 KiB");
      expect(formatBytes(10 * 1024)).toBe("10 KiB");
   });

   it("stays in the largest unit past the top of the range", () => {
      expect(formatBytes(1024 ** 5)).toBe("1024 TiB");
      expect(formatBytes(2 * 1024 ** 6)).toBe("2097152 TiB");
   });
});

describe("pluralize", () => {
   it("only pluralizes counts other than one", () => {
      expect(pluralize(0, "object")).toBe("0 objects");
      expect(pluralize(1, "object")).toBe("1 object");
      expect(pluralize(2, "object")).toBe("2 objects");
   });
});
