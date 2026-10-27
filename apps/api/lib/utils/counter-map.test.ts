import { describe, expect, it } from "vitest";
import { bump, countOf } from "./counter-map";

describe("bump", () => {
   it.each([
      ["counts a new key", undefined, 1, 1, true],
      ["adds to an existing key", 2, 1, 3, true],
      ["keeps a key that stays positive", 2, -1, 1, true],
      ["drops a key that reaches zero", 1, -1, 0, false],
      ["drops a key that would go negative", undefined, -1, 0, false],
      [
         "drops a key on a zero delta when it is unknown",
         undefined,
         0,
         0,
         false,
      ],
   ] as const)("%s", (_name, before, delta, expected, kept) => {
      const counts = new Map<string, number>();
      if (before !== undefined) counts.set("k", before);
      expect(bump(counts, "k", delta)).toBe(expected);
      expect(counts.has("k")).toBe(kept);
      expect(countOf(counts, "k")).toBe(expected);
   });

   it("leaves other keys alone", () => {
      const counts = new Map([
         ["a", 1],
         ["b", 1],
      ]);
      bump(counts, "a", -1);
      expect([...counts]).toEqual([["b", 1]]);
   });
});
