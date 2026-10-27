// @vitest-environment happy-dom
import { mountRuntime } from "@/lib/test/runtime";
import { SITE_PATHS } from "@s3-viewer/shared";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   inApp: false,
   router: { back: vi.fn(), push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/router", () => ({ useRouter: () => h.router }));
vi.mock("@/lib/navigation-guard", () => ({
   hasInAppHistory: () => h.inApp,
}));

import { useGoBack } from "./useGoBack";

const page = { goBack: () => {} };
const Probe = () => {
   page.goBack = useGoBack();
   return null;
};

let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;

beforeEach(async () => {
   vi.clearAllMocks();
   runtime = await mountRuntime(createElement(Probe));
});
afterEach(async () => {
   await runtime?.unmount();
   runtime = undefined;
   document.body.replaceChildren();
});

describe("going back from a server page", () => {
   it("returns to the previous page in the app", () => {
      h.inApp = true;
      page.goBack();
      expect(h.router.back).toHaveBeenCalledOnce();
      expect(h.router.push).not.toHaveBeenCalled();
   });

   it("goes to the dashboard instead of leaving the app", () => {
      h.inApp = false;
      page.goBack();
      expect(h.router.back).not.toHaveBeenCalled();
      expect(h.router.push).toHaveBeenCalledExactlyOnceWith(
         SITE_PATHS.dashboard
      );
   });
});

describe("escape on a server page", () => {
   const pressEscape = (target: HTMLElement) => {
      document.body.append(target);
      target.dispatchEvent(
         new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
   };

   it("leaves the page from a plain button", () => {
      h.inApp = true;
      pressEscape(document.createElement("button"));
      expect(h.router.back).toHaveBeenCalledOnce();
   });

   it("stays put while a closed select still has focus", () => {
      h.inApp = true;
      const trigger = document.createElement("button");
      trigger.setAttribute("role", "combobox");
      pressEscape(trigger);
      expect(h.router.back).not.toHaveBeenCalled();
      expect(h.router.push).not.toHaveBeenCalled();
   });

   it("leaves an open dialog to handle its own escape", () => {
      h.inApp = true;
      const dialog = document.createElement("div");
      dialog.setAttribute("data-slot", "dialog-content");
      document.body.append(dialog);
      pressEscape(document.createElement("button"));
      expect(h.router.back).not.toHaveBeenCalled();
   });
});
