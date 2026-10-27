// @vitest-environment happy-dom
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";

const h = vi.hoisted(() => ({
   pathname: "/login",
   query: {} as Record<string, string>,
   replace: vi.fn(async () => true),
   session: {
      data: null as { user: { id: string; emailVerified: boolean } } | null,
      isPending: true,
      error: null as unknown,
   },
   signOut: vi.fn(async () => {}),
}));

vi.mock("next/router", () => ({
   useRouter: () => ({
      pathname: h.pathname,
      asPath: h.pathname,
      query: h.query,
      isReady: true,
      replace: h.replace,
   }),
}));
vi.mock("@/lib/auth", () => ({
   authClient: { useSession: () => h.session },
   // the real flag flips as soon as a sign-out starts
   isSigningOut: () => h.signOut.mock.calls.length > 0,
   refetchSession: vi.fn(),
   signOut: h.signOut,
}));
vi.mock("./shell-skeleton", () => ({
   default: () => createElement("div", { "data-testid": "skeleton" }),
}));
vi.mock("./session-unreachable", () => ({ default: () => null }));

import AuthGuard from "./auth-guard";

const view = mountedRuntime();
const mount = async () => {
   await view.mount(
      createElement(AuthGuard, null, createElement("p", null, "page"))
   );
   await flushRuntime();
   return view.current.container;
};

beforeEach(() => {
   vi.clearAllMocks();
   h.pathname = "/login";
   h.query = {};
   h.session = { data: null, isPending: true, error: null };
});

describe("auth screens", () => {
   it("render at once, before the session request has answered", async () => {
      const container = await mount();
      expect(container.textContent).toBe("page");
      expect(container.querySelector("[data-testid=skeleton]")).toBeNull();
      expect(h.replace).not.toHaveBeenCalled();
   });

   it("send a signed-in visitor on to where they were going", async () => {
      h.query = { next: "/settings/invites?invite=abc12345" };
      h.session = {
         data: { user: { id: "u1", emailVerified: true } },
         isPending: false,
         error: null,
      };
      await mount();
      expect(h.replace).toHaveBeenCalledExactlyOnceWith(
         "/settings/invites?invite=abc12345"
      );
   });

   it("end a session whose email was never verified instead of treating it as signed in", async () => {
      h.session = {
         data: { user: { id: "u1", emailVerified: false } },
         isPending: false,
         error: null,
      };
      const container = await mount();
      expect(container.textContent).toBe("page");
      expect(h.replace).not.toHaveBeenCalled();
      expect(h.signOut).toHaveBeenCalledOnce();
   });
});

describe("app pages", () => {
   it("hold the shell until the session is known, then send a stranger to log in", async () => {
      h.pathname = "/dashboard";
      const container = await mount();
      expect(container.querySelector("[data-testid=skeleton]")).not.toBeNull();
      h.session = { data: null, isPending: false, error: null };
      await view.mount(
         createElement(AuthGuard, null, createElement("p", null, "page"))
      );
      await flushRuntime();
      expect(h.replace).toHaveBeenCalledExactlyOnceWith(
         "/login?next=%2Fdashboard"
      );
   });
});
