// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime, submitForm } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";
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

const view = mountedRuntime();
const mount = () => view.mount(createElement(ResetPasswordScreen));

beforeEach(() => {
   h.resetPassword.mockReset();
   h.resetPassword.mockResolvedValue({ error: null });
   h.replace.mockReset();
   h.replace.mockResolvedValue(true);
   h.query = { token: "reset-token-from-email" };
});

describe("reset password link", () => {
   it("drops the token from the address bar but still uses it", async () => {
      const { container } = await mount();
      await flushRuntime();
      expect(h.replace).toHaveBeenCalledWith("/reset-password", undefined, {
         shallow: true,
      });

      h.query = {};
      await act(async () =>
         h.onPassword({ target: { value: "a-brand-new-password-2026" } })
      );
      await act(async () => {
         submitForm(container);
      });
      expect(h.resetPassword).toHaveBeenCalledWith(
         "reset-token-from-email",
         "a-brand-new-password-2026"
      );
   });

   it("shows the broken-link screen and leaves the url alone without a token", async () => {
      h.query = {};
      const { container } = await mount();
      await flushRuntime();
      expect(h.replace).not.toHaveBeenCalled();
      expect(container.querySelector("h1")?.textContent).toBe(
         "This link doesn't work"
      );
   });
});
