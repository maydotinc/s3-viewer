// @vitest-environment happy-dom
import { deferred } from "@/lib/test/runtime";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "./test-helpers";

const h = vi.hoisted(() => ({
   requestSignOut: vi.fn<(redirectTo?: string) => Promise<void>>(),
   toastFailure: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requestSignOut: h.requestSignOut }));
vi.mock("@/lib/utils/toast", () => ({ toastFailure: h.toastFailure }));

import StaleSignIn, { signInAgain } from "./stale-sign-in";

const view = mountedRuntime();
const signInButton = () => {
   const found = view.current.container.querySelector("button");
   if (!found) throw new Error("No sign-in button.");
   return found;
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("signing in again from a stale session", () => {
   it("shows the button busy until the sign-out settles, then reports a failure", async () => {
      const pending = deferred<void>();
      h.requestSignOut.mockReturnValue(pending.promise);
      await view.mount(
         createElement(StaleSignIn, { title: "Sign in", action: "this" })
      );
      await act(async () => signInButton().click());
      expect(signInButton().disabled).toBe(true);
      expect(signInButton().getAttribute("aria-busy")).toBe("true");
      const failure = new Error("offline");
      await act(async () => pending.reject(failure));
      expect(h.toastFailure).toHaveBeenCalledExactlyOnceWith(failure);
      expect(signInButton().disabled).toBe(false);
   });

   it("comes back to the page it was on", async () => {
      h.requestSignOut.mockResolvedValue();
      window.history.replaceState(null, "", "/settings/profile?tab=a");
      await view.mount(
         createElement(StaleSignIn, { title: "Sign in", action: "this" })
      );
      await act(async () => signInButton().click());
      expect(h.requestSignOut.mock.calls[0]?.[0]).toContain(
         encodeURIComponent("/settings/profile?tab=a")
      );
   });

   it("reports a failure from the bare action too", async () => {
      const failure = new Error("offline");
      h.requestSignOut.mockRejectedValue(failure);
      signInAgain();
      await vi.waitFor(() =>
         expect(h.toastFailure).toHaveBeenCalledExactlyOnceWith(failure)
      );
   });
});
