// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";

const h = vi.hoisted(() => ({
   verifyEmailCode: vi.fn(),
   sendVerificationCode: vi.fn(),
   onBack: vi.fn(),
   onVerified: vi.fn(async () => {}),
}));

vi.mock("next/link", () => ({
   default: ({ children, href }: { children: ReactNode; href: string }) =>
      createElement("a", { href }, children),
}));
vi.mock("@/lib/auth", () => ({
   verifyEmailCode: h.verifyEmailCode,
   sendVerificationCode: h.sendVerificationCode,
}));

import VerifyCodeStep from "./verify-code-step";

const view = mountedRuntime();
const setValue = Object.getOwnPropertyDescriptor(
   HTMLInputElement.prototype,
   "value"
)!.set!;

const mount = async () => {
   await view.mount(
      createElement(VerifyCodeStep, {
         email: "me@example.com",
         password: "the-password",
         codeInLog: false,
         backLabel: "Back to log in",
         onBack: h.onBack,
         onVerified: h.onVerified,
      })
   );
   return view.current.container;
};
const field = (container: HTMLElement) =>
   container.querySelector<HTMLInputElement>("#verification-code")!;
const type = async (input: HTMLInputElement, text: string) => {
   await act(async () => {
      setValue.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
   });
   await flushRuntime();
};
const message = (container: HTMLElement) =>
   container.querySelector("#verification-code-message")!;

beforeEach(() => {
   vi.clearAllMocks();
   h.verifyEmailCode.mockResolvedValue({ error: null });
   h.sendVerificationCode.mockResolvedValue({ error: null });
});

afterEach(() => vi.useRealTimers());

describe("entering the code", () => {
   it("submits on the sixth digit with the password it was given", async () => {
      const container = await mount();
      await type(field(container), "12345");
      expect(h.verifyEmailCode).not.toHaveBeenCalled();
      await type(field(container), "123456");
      expect(h.verifyEmailCode).toHaveBeenCalledExactlyOnceWith(
         "me@example.com",
         "123456",
         "the-password"
      );
      expect(h.onVerified).toHaveBeenCalledOnce();
   });

   it("keeps only the digits of whatever was pasted", async () => {
      const container = await mount();
      await type(field(container), "12 34-5x");
      expect(field(container).value).toBe("12345");
      expect(h.verifyEmailCode).not.toHaveBeenCalled();
   });

   it("shows the server's wrong-code message and leaves the field editable", async () => {
      h.verifyEmailCode.mockResolvedValue({
         error: "That code isn't right. Check it and try again.",
         code: "INVALID_OTP",
      });
      const container = await mount();
      await type(field(container), "000000");
      expect(message(container).textContent).toBe(
         "That code isn't right. Check it and try again."
      );
      expect(message(container).getAttribute("role")).toBe("alert");
      expect(field(container).disabled).toBe(false);
      expect(field(container).readOnly).toBe(false);
      expect(field(container).getAttribute("aria-invalid")).toBe("true");
      expect(h.onVerified).not.toHaveBeenCalled();
   });

   it("sends the person back to the form when the password no longer matches", async () => {
      h.verifyEmailCode.mockResolvedValue({
         error: "Wrong email or password.",
         code: "INVALID_EMAIL_OR_PASSWORD",
      });
      const container = await mount();
      await type(field(container), "123456");
      expect(h.onBack).toHaveBeenCalledExactlyOnceWith(
         "Your password changed. Log in again to continue."
      );
   });

   it("swaps resend for a reset link once the address's code guesses are spent", async () => {
      h.verifyEmailCode.mockResolvedValue({
         error: "Too many wrong codes. Try again later, or reset your password to verify this email.",
         code: "VERIFICATION_LOCKED",
      });
      const container = await mount();
      await type(field(container), "000000");
      const reset = container.querySelector("a");
      expect(reset?.textContent).toBe("Reset password");
      expect(reset?.getAttribute("href")).toBe("/forgot-password");
      expect(container.textContent).not.toContain("Resend code");
      await type(field(container), "1");
      expect(container.querySelector("a")?.textContent).toBe("Reset password");
   });
});

describe("resending", () => {
   it("waits out the cooldown from the code that was just sent, then mails again", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
      const container = await mount();
      const resend = () =>
         [...container.querySelectorAll("button")].find((button) =>
            button.textContent?.startsWith("Resend code")
         )!;
      expect(resend().disabled).toBe(true);
      expect(resend().textContent).toBe("Resend code in 60s");
      await act(async () => vi.advanceTimersByTime(61_000));
      expect(resend().disabled).toBe(false);
      expect(resend().textContent).toBe("Resend code");
      await act(async () => resend().click());
      await flushRuntime();
      expect(h.sendVerificationCode).toHaveBeenCalledExactlyOnceWith(
         "me@example.com"
      );
      expect(message(container).textContent).toBe("Code sent.");
      expect(message(container).getAttribute("role")).toBe("status");
      expect(resend().disabled).toBe(true);
   });
});
