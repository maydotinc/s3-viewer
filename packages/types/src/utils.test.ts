import { describe, expect, it } from "vitest";
import { chunkKeys, mapLimit } from "./utils";

const tick = () => new Promise<void>((r) => setTimeout(r, 1));

describe("chunkKeys", () => {
   it("splits by key count and by total characters, never leaving a batch empty", () => {
      expect(chunkKeys(["aaaa", "bbbb", "cccc"], 2, 100)).toEqual([
         ["aaaa", "bbbb"],
         ["cccc"],
      ]);
      expect(chunkKeys(["aaaa", "bbbb", "cccc"], 10, 8)).toEqual([
         ["aaaa", "bbbb"],
         ["cccc"],
      ]);
      expect(chunkKeys(["a".repeat(20), "b"], 10, 8)).toEqual([
         ["a".repeat(20)],
         ["b"],
      ]);
      expect(chunkKeys([], 10, 8)).toEqual([]);
   });
});

describe("mapLimit", () => {
   it("preserves order and never exceeds the concurrency limit", async () => {
      let inFlight = 0;
      let peak = 0;
      const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
         inFlight++;
         peak = Math.max(peak, inFlight);
         await tick();
         inFlight--;
         return n * 2;
      });
      expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
      expect(peak).toBe(3);
   });

   it("handles empty input", async () => {
      expect(await mapLimit([], 5, async (x: number) => x)).toEqual([]);
   });

   it("rejects when a worker rejects and stops scheduling more", async () => {
      const started: number[] = [];
      await expect(
         mapLimit([1, 2, 3, 4], 1, async (n) => {
            started.push(n);
            if (n === 2) throw new Error("boom");
            return n;
         })
      ).rejects.toThrow("boom");
      expect(started).toEqual([1, 2]);
   });
});
