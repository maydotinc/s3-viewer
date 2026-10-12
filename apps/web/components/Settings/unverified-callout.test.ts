// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";

const h = vi.hoisted(() => ({
   email: "disabled" as "enabled" | "disabled" | "loading",
   writeText: vi.fn(),
   success: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({ data: { user: { email: "me@example.com" } } }),
   },
}));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({}),
   emailState: () => h.email,
}));
vi.mock("@/lib/hooks/mutations/user/useResendVerification", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ success: h.success })
);

const view = mountedRuntime(() => vi.unstubAllEnvs());
const callout = async () => {
   const { default: UnverifiedCallout } = await import("./unverified-callout");
   await view.mount(
      createElement(UnverifiedCallout, { action: "connect a server" })
   );
   return view.current.container;
};
const copy = async (container: HTMLElement) => {
   const button = container.querySelector("button")!;
   await act(async () => button.click());
   return button.textContent;
};

beforeEach(() => {
   vi.clearAllMocks();
   vi.resetModules();
   h.writeText.mockResolvedValue(undefined);
   Object.defineProperty(navigator, "clipboard", {
      value: { writeText: h.writeText },
      configurable: true,
   });
});

describe("an instance without email", () => {
   it("tells the user to send the operator their address, and copies it", async () => {
      const container = await callout();
      expect(container.textContent).toContain("self-hosting guide");
      expect(container.textContent).toContain("me@example.com");
      expect(container.textContent).not.toContain("docker");
      expect(container.textContent).not.toContain("account:verify");
      expect(await copy(container)).toContain("Copy email address");
      expect(h.writeText).toHaveBeenCalledExactlyOnceWith("me@example.com");
      expect(h.success).toHaveBeenCalledOnce();
   });

   it("hands contributors the verify command in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const container = await callout();
      expect(container.textContent).toContain(
         "pnpm account:verify me@example.com"
      );
      expect(await copy(container)).toContain("Copy command");
      expect(h.writeText).toHaveBeenCalledExactlyOnceWith(
         "pnpm account:verify me@example.com"
      );
   });
});

describe("an instance with email", () => {
   it("offers to resend the verification email instead", async () => {
      h.email = "enabled";
      const container = await callout();
      expect(container.textContent).toContain("Verify your email address");
      expect(container.querySelector("button")?.textContent).toContain(
         "Resend verification email"
      );
   });
});
