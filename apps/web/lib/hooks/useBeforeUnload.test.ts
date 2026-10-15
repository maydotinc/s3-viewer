// @vitest-environment happy-dom
import { mountRuntime } from "@/lib/test/runtime";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { useBeforeUnload } from "./useBeforeUnload";

const Guarded = ({ active }: { active: boolean }) => {
   useBeforeUnload(active);
   return null;
};

const unloadCancelled = () => {
   const event = new Event("beforeunload", { cancelable: true });
   window.dispatchEvent(event);
   return event.defaultPrevented;
};

describe("useBeforeUnload", () => {
   it("cancels unload only while mounted and active", async () => {
      const inactive = await mountRuntime(
         createElement(Guarded, { active: false })
      );
      expect(unloadCancelled()).toBe(false);
      await inactive.unmount();
      const active = await mountRuntime(
         createElement(Guarded, { active: true })
      );
      expect(unloadCancelled()).toBe(true);
      await active.unmount();
      expect(unloadCancelled()).toBe(false);
   });
});
