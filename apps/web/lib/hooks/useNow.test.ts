// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { MINUTE_MS } from "@s3-viewer/types";
import { mountRuntime } from "@/lib/test/runtime";
import { useNow } from "./useNow";

const Clock = () => createElement("time", null, useNow());

afterEach(() => {
   vi.useRealTimers();
   vi.unstubAllGlobals();
});

describe("useNow", () => {
   it("shares one interval across clocks and stops it when the last one unmounts", async () => {
      vi.useFakeTimers({ now: 1_000 });
      const runtime = await mountRuntime([
         createElement(Clock, { key: "a" }),
         createElement(Clock, { key: "b" }),
      ]);
      const times = () =>
         [...runtime.container.querySelectorAll("time")].map(
            (time) => time.textContent
         );
      expect(times()).toEqual(["1000", "1000"]);
      expect(vi.getTimerCount()).toBe(1);
      await act(async () => {
         vi.advanceTimersByTime(MINUTE_MS);
      });
      expect(times()).toEqual(Array(2).fill(String(1_000 + MINUTE_MS)));
      await runtime.unmount();
      expect(vi.getTimerCount()).toBe(0);
   });
});
