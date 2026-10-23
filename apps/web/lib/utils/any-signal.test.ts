import { afterEach, describe, expect, it, vi } from "vitest";
import { anySignal } from "./any-signal";

const native = AbortSignal.any;

const setAny = (value: typeof native | undefined) =>
   Object.defineProperty(AbortSignal, "any", {
      value,
      configurable: true,
      writable: true,
   });

afterEach(() => setAny(native));

describe.each([
   ["native", native],
   ["fallback", undefined],
])("anySignal (%s)", (_name, any) => {
   it("aborts with the reason of whichever input aborts first", () => {
      setAny(any);
      const first = new AbortController();
      const second = new AbortController();
      const combined = anySignal([first.signal, second.signal]);
      expect(combined.aborted).toBe(false);
      const reason = new DOMException("late", "TimeoutError");
      second.abort(reason);
      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe(reason);
      first.abort(new Error("ignored"));
      expect(combined.reason).toBe(reason);
   });

   it("starts aborted when an input already is", () => {
      setAny(any);
      const done = new AbortController();
      done.abort("gone");
      const combined = anySignal([new AbortController().signal, done.signal]);
      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe("gone");
   });
});

it("stops listening to the other inputs once one aborts without AbortSignal.any", () => {
   setAny(undefined);
   const first = new AbortController();
   const second = new AbortController();
   const removed = vi.spyOn(first.signal, "removeEventListener");
   anySignal([first.signal, second.signal]);
   second.abort();
   expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
});
