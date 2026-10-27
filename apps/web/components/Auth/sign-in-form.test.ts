// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime, submitForm } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";
import SignInForm, { type Mode } from "./sign-in-form";

const h = vi.hoisted(() => ({
   continueWithPassword: vi.fn(),
   onEmail: (_value: string) => {},
   onPassword: (_event: { target: { value: string } }) => {},
}));

vi.mock("@/lib/auth", () => ({
   continueWithPassword: h.continueWithPassword,
}));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({ data: { signUpMode: "open" }, isPending: false }),
   githubEnabled: () => false,
   signUpPolicyState: () => ({ mode: "open", domains: [] }),
}));
vi.mock("next/link", () => ({
   default: ({ children }: { children: ReactNode }) =>
      createElement("a", null, children),
}));
vi.mock("./email-field", () => ({
   default: (props: { onChange: (value: string) => void }) => {
      h.onEmail = props.onChange;
      return null;
   },
}));
vi.mock("./password-input", () => ({
   default: (props: { onChange: typeof h.onPassword }) => {
      h.onPassword = props.onChange;
      return null;
   },
}));

const view = mountedRuntime();

beforeEach(() => {
   h.continueWithPassword.mockReset();
   h.continueWithPassword.mockResolvedValue({
      error: "Wrong email or password.",
      code: "INVALID_EMAIL_OR_PASSWORD",
      created: false,
   });
});

const submitAs = async (mode: Mode, inviteId?: string) => {
   const { container } = await view.mount(
      createElement(SignInForm, {
         mode,
         notice: null,
         inviteId,
         onGithub: () => {},
         onDone: async () => {},
      })
   );
   await act(async () => h.onEmail("typo@gmial.com"));
   await act(async () =>
      h.onPassword({ target: { value: "a-long-enough-password" } })
   );
   await act(async () => {
      submitForm(container);
   });
   await flushRuntime();
   return container;
};

describe("password sign-in", () => {
   it("never creates an account from the login page", async () => {
      const container = await submitAs("login");
      expect(h.continueWithPassword).toHaveBeenCalledWith(
         "typo@gmial.com",
         "a-long-enough-password",
         { allowSignUp: false, inviteId: undefined }
      );
      expect(container.textContent).toContain("Wrong email or password.");
   });

   it("creates the account from the sign-up page", async () => {
      await submitAs("signup");
      expect(h.continueWithPassword).toHaveBeenCalledWith(
         "typo@gmial.com",
         "a-long-enough-password",
         { allowSignUp: true, inviteId: undefined }
      );
   });

   it("offers a password reset when the sign-up address already has an account", async () => {
      h.continueWithPassword.mockResolvedValue({
         error: "Wrong email or password.",
         code: "INVALID_EMAIL_OR_PASSWORD",
         created: false,
         exists: true,
      });
      const container = await submitAs("signup");
      expect(container.textContent).toContain("Wrong email or password.");
      expect(container.textContent).toContain("Forgot password?");
      await act(async () => h.onEmail("someone-else@example.com"));
      expect(container.textContent).not.toContain("Forgot password?");
   });

   it("offers no reset on a sign-up refused for another reason", async () => {
      const container = await submitAs("signup");
      expect(container.textContent).toContain("Wrong email or password.");
      expect(container.textContent).not.toContain("Forgot password?");
   });

   it("still lets an invitation link create the invited account from the login page", async () => {
      await submitAs("login", "invite-token-123");
      expect(h.continueWithPassword).toHaveBeenCalledWith(
         "typo@gmial.com",
         "a-long-enough-password",
         { allowSignUp: true, inviteId: "invite-token-123" }
      );
   });
});
