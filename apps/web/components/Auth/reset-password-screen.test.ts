// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushRuntime, mountRuntime } from "@/lib/test/runtime";
import ResetPasswordScreen from "./reset-password-screen";

const h = vi.hoisted(() => ({
   resetPassword: vi.fn(),
   replace: vi.fn(),
   query: {} as Record<string, string>,
   onPassword: (_event: { target: { value: string } }) => {},
}));

vi.mock("next/router", () => ({
   useRouter: () => ({ isReady: true, query: h.query, replace: h.replace }),
}));
vi.mock("next/link", () => ({
   default: ({ children }: { children: ReactNode }) =>
      createElement("a", null, children),
}));
vi.mock("@/lib/auth", () => ({ resetPassword: h.resetPassword }));
vi.mock("./auth-layout", () => ({
   AuthLayout: ({ children }: { children: ReactNode }) =>
      createElement("main", null, children),
   StepHeader: ({ title }: { title: string }) =>
      createElement("h1", null, title),
}));
vi.mock("./password-input", () => ({
   default: (props: { onChange: typeof h.onPassword }) => {
      h.onPassword = props.onChange;
      return null;
   },
}));

const mounted: Awaited<ReturnType<typeof mountRuntime>>[] = [];

beforeEach(() => {
   h.resetPassword.mockReset();
   h.resetPassword.mockResolvedValue({ error: null });
   h.replace.mockReset();
   h.replace.mockResolvedValue(true);
   h.query = { token: "reset-token-from-email" };
});

afterEach(async () => {
   while (mounted.length) await mounted.pop()!.unmount();
});

describe("reset password link", () => {
   it("drops the token from the address bar but still uses it", async () => {
      const runtime = await mountRuntime(createElement(ResetPasswordScreen));
      mounted.push(runtime);
      await flushRuntime();
      expect(h.replace).toHaveBeenCalledWith("/reset-password", undefined, {
         shallow: true,
      });

      h.query = {};
      await act(async () =>
         h.onPassword({ target: { value: "a-brand-new-password-2026" } })
      );
      await act(async () => {
         runtime.container
            .querySelector("form")!
            .dispatchEvent(
               new Event("submit", { bubbles: true, cancelable: true })
            );
      });
      expect(h.resetPassword).toHaveBeenCalledWith(
         "reset-token-from-email",
         "a-brand-new-password-2026"
      );
   });

   it("shows the broken-link screen and leaves the url alone without a token", async () => {
      h.query = {};
      const runtime = await mountRuntime(createElement(ResetPasswordScreen));
      mounted.push(runtime);
      await flushRuntime();
      expect(h.replace).not.toHaveBeenCalled();
      expect(runtime.container.querySelector("h1")?.textContent).toBe(
         "This link doesn't work"
      );
   });
});
