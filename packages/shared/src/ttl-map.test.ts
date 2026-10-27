import { describe, expect, it } from "vitest";
import { memoryWindows, ttlMap } from "./ttl-map";

describe("ttlMap", () => {
   it("answers a value until it expires", () => {
      const map = ttlMap<string, number>(10);
      map.set("k", 1, 100, 0);
      expect(map.get("k", 99)).toBe(1);
      expect(map.get("k", 100)).toBeUndefined();
   });

   it("drops the least recently written key past the cap", () => {
      const map = ttlMap<string, number>(2);
      map.set("a", 1, 100, 0);
      map.set("b", 2, 100, 0);
      map.set("a", 3, 100, 0);
      map.set("c", 4, 100, 0);
      expect(map.get("b", 0)).toBeUndefined();
      expect(map.get("a", 0)).toBe(3);
      expect(map.get("c", 0)).toBe(4);
   });

   it("sweeps expired keys so live ones are not evicted for them", () => {
      const map = ttlMap<string, number>(1000);
      map.set("live", 1, 10_000, 0);
      for (let i = 0; i < 998; i++) map.set(`stale:${i}`, i, 10, 0);
      map.set("late", 2, 10_000, 20);
      for (let i = 0; i < 998; i++) map.set(`more:${i}`, i, 10_000, 20);
      expect(map.get("live", 20)).toBe(1);
   });
});

describe("memoryWindows", () => {
   it("counts a fixed window from its first hit, and forgets a key on reset", () => {
      const windows = memoryWindows(10);
      expect(windows.hit("k", 100, 0)).toEqual({ hits: 1, resetAt: 100 });
      expect(windows.hit("k", 100, 50)).toEqual({ hits: 2, resetAt: 100 });
      windows.undo("k");
      expect(windows.hit("k", 100, 60).hits).toBe(2);
      windows.reset("k");
      expect(windows.hit("k", 100, 70)).toEqual({ hits: 1, resetAt: 170 });
      expect(windows.hit("k", 100, 170)).toEqual({ hits: 1, resetAt: 270 });
   });
});
