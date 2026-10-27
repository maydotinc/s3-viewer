import { describe, expect, it, vi } from "vitest";
import { keyedSlots, type SlotClaim } from "./keyed-slots";

const claim = (key: string, cap: number): SlotClaim => [
   key,
   cap,
   () => new Error(`${key} is full`),
];

describe("keyedSlots", () => {
   it("refuses with the first full claim in order and takes nothing", () => {
      const slots = keyedSlots();
      slots.acquire([claim("server", 1), claim("user", 1)]);
      expect(() =>
         slots.acquire([claim("user", 2), claim("server", 1)])
      ).toThrow("server is full");
      expect(slots.held("user")).toBe(1);
      expect(slots.tryAcquire([claim("server", 1)])).toBeUndefined();
   });

   it("frees every key once however often the release runs", () => {
      const slots = keyedSlots();
      const onRelease = vi.fn();
      const release = slots.acquire(
         [claim("all", 2), claim("user", 2)],
         onRelease
      );
      slots.acquire([claim("all", 2)]);
      release();
      release();
      expect(slots.held("all")).toBe(1);
      expect(slots.held("user")).toBe(0);
      expect(onRelease).toHaveBeenCalledOnce();
   });

   it("skips claims that do not apply", () => {
      const slots = keyedSlots();
      const release = slots.tryAcquire([undefined, claim("all", 1)]);
      expect(release).toBeTypeOf("function");
      expect(() => slots.acquire([undefined, claim("all", 1)])).toThrow(
         "all is full"
      );
      release?.();
      slots.clear();
      expect(slots.acquire([])).toBeTypeOf("function");
   });
});
