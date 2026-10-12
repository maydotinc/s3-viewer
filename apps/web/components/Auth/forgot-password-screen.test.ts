// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushRuntime, mountRuntime } from "@/lib/test/runtime";
import ForgotPasswordScreen from "./forgot-password-screen";

const h = vi.hoisted(() => ({
   requestPasswordReset: vi.fn(),
   onEmailChange: (_value: string) => {},
}));

vi.mock("@/lib/auth", () => ({
   requestPasswordReset: h.requestPasswordReset,
}));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({ data: { emailEnabled: true }, isPending: false }),
   emailState: () => "enabled",
}));
vi.mock("./auth-layout", () => ({
   AuthLayout: ({ children }: { children: ReactNode }) =>
      createElement("main", null, children),
   StepHeader: ({ title, children }: { title: string; children: ReactNode }) =>
      createElement("header", null, createElement("h1", null, title), children),
}));
vi.mock("./email-field", () => ({
   default: (props: { onChange: (value: string) => void }) => {
      h.onEmailChange = props.onChange;
      return null;
   },
}));

const mounted: Awaited<ReturnType<typeof mountRuntime>>[] = [];

const mountScreen = async () => {
   const runtime = await mountRuntime(createElement(ForgotPasswordScreen));
   mounted.push(runtime);
   return runtime.container;
};

const buttonNamed = (container: HTMLElement, name: string) =>
   Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === name
   )!;

const status = (container: HTMLElement) =>
   container.querySelector('[role="status"], [role="alert"]')!;

const reachSentStep = async (container: HTMLElement) => {
   await act(async () => h.onEmailChange("person@example.com"));
   await act(async () => {
      container
         .querySelector("form")!
         .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
         );
   });
   await flushRuntime();
   expect(container.querySelector("h1")?.textContent).toBe("Check your inbox");
};

beforeEach(() => {
   h.requestPasswordReset.mockReset();
   h.requestPasswordReset.mockResolvedValue({});
});

afterEach(async () => {
   while (mounted.length) await mounted.pop()!.unmount();
});

describe("resending a password reset link", () => {
   it("confirms a resend in the space reserved under the prompt", async () => {
      const container = await mountScreen();
      await reachSentStep(container);
      const slot = status(container);
      expect(slot.textContent).toBe("");

      await act(async () => buttonNamed(container, "Send again").click());
      await flushRuntime();

      expect(h.requestPasswordReset).toHaveBeenCalledTimes(2);
      expect(status(container)).toBe(slot);
      expect(slot.getAttribute("role")).toBe("status");
      expect(slot.textContent).toBe("Sent again.");
   });

   it("clears a failed resend once a later one goes through", async () => {
      const container = await mountScreen();
      await reachSentStep(container);

      h.requestPasswordReset.mockResolvedValueOnce({
         error: "Too many requests",
      });
      await act(async () => buttonNamed(container, "Send again").click());
      await flushRuntime();
      expect(status(container).getAttribute("role")).toBe("alert");
      expect(status(container).textContent).toBe("Too many requests");

      await act(async () => buttonNamed(container, "Send again").click());
      await flushRuntime();
      expect(status(container).getAttribute("role")).toBe("status");
      expect(status(container).textContent).toBe("Sent again.");
   });

   it("drops the resend error when going back to change the email", async () => {
      const container = await mountScreen();
      await reachSentStep(container);
      h.requestPasswordReset.mockResolvedValueOnce({
         error: "Too many requests",
      });
      await act(async () => buttonNamed(container, "Send again").click());
      await flushRuntime();

      await act(async () =>
         buttonNamed(container, "use another email").click()
      );
      await act(async () => h.onEmailChange("other@example.com"));
      await act(async () => {
         container
            .querySelector("form")!
            .dispatchEvent(
               new Event("submit", { bubbles: true, cancelable: true })
            );
      });
      await flushRuntime();
      expect(status(container).textContent).toBe("");
   });
});
