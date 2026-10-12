// @vitest-environment happy-dom
import { mountRuntime } from "@/lib/test/runtime";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBeforeUnload } from "./useBeforeUnload";

const Guarded = ({ active }: { active: boolean }) => {
   useBeforeUnload(active);
   return null;
};

let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
const mount = async (active: boolean) => {
   runtime = await mountRuntime(createElement(Guarded, { active }));
};
const warnings = () =>
   vi
      .mocked(window.addEventListener)
      .mock.calls.filter(([type]) => type === "beforeunload")
      .map(([, listener]) => listener);

beforeEach(() => {
   vi.spyOn(window, "addEventListener");
   vi.spyOn(window, "removeEventListener");
});
afterEach(async () => {
   await runtime?.unmount();
   runtime = undefined;
   vi.restoreAllMocks();
});

describe("useBeforeUnload", () => {
   it("warns only while active", async () => {
      await mount(false);
      expect(warnings()).toHaveLength(0);
      await runtime!.unmount();
      await mount(true);
      expect(warnings().length).toBeGreaterThan(0);
   });

   it("cancels the unload event it is handed", async () => {
      await mount(true);
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
   });

   it("removes the same listener on unmount", async () => {
      await mount(true);
      const [warn] = warnings();
      await runtime!.unmount();
      expect(window.removeEventListener).toHaveBeenCalledWith(
         "beforeunload",
         warn
      );
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
   });
});
