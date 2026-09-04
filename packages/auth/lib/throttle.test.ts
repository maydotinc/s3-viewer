import { describe, expect, it } from "vitest";
import { createThrottle } from "./throttle";

describe("createThrottle", () => {
   it("allows up to the limit inside the window and refuses after", () => {
      const throttle = createThrottle(2, 1000);
      expect(throttle.allow("a", 0)).toBe(true);
      expect(throttle.allow("a", 10)).toBe(true);
      expect(throttle.allow("a", 20)).toBe(false);
   });

   it("keys are independent", () => {
      const throttle = createThrottle(1, 1000);
      expect(throttle.allow("a", 0)).toBe(true);
      expect(throttle.allow("b", 0)).toBe(true);
      expect(throttle.allow("a", 0)).toBe(false);
   });

   it("lets a key through again once the window has passed", () => {
      const throttle = createThrottle(1, 1000);
      expect(throttle.allow("a", 0)).toBe(true);
      expect(throttle.allow("a", 999)).toBe(false);
      expect(throttle.allow("a", 1000)).toBe(true);
   });

   it("a refused attempt does not extend the window", () => {
      const throttle = createThrottle(1, 1000);
      expect(throttle.allow("a", 0)).toBe(true);
      expect(throttle.allow("a", 900)).toBe(false);
      expect(throttle.allow("a", 1000)).toBe(true);
   });

   it("sweeps expired keys so memory stays bounded", () => {
      const throttle = createThrottle(1, 100);
      for (let i = 0; i < 999; i++) throttle.allow(`k${i}`, 0);
      expect(throttle.size()).toBe(999);
      throttle.allow("late", 10_000);
      expect(throttle.size()).toBe(1);
   });
});
