// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./error-boundary";

const page = { broken: true };
const Page = () => {
   if (page.broken) throw new Error("render failed");
   return createElement("p", null, "dashboard");
};

let container: HTMLDivElement;
let root: Root;
const render = (resetKey: string, fallback?: ReactNode) =>
   act(async () => {
      root.render(
         createElement(
            ErrorBoundary,
            { resetKey, fallback },
            createElement(Page)
         )
      );
   });

beforeEach(() => {
   vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
   vi.spyOn(console, "error").mockImplementation(() => {});
   page.broken = true;
   container = document.createElement("div");
   document.body.append(container);
   root = createRoot(container);
});

afterEach(async () => {
   await act(async () => root.unmount());
   container.remove();
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});

describe("the app-wide error boundary", () => {
   it("keeps the error page while the address stays the same", async () => {
      await render("/buckets/a");
      expect(container.textContent).toContain("Something went wrong");
      page.broken = false;
      await render("/buckets/a");
      expect(container.textContent).toContain("Something went wrong");
   });

   it("renders the app again once the user navigates away", async () => {
      await render("/buckets/a");
      expect(container.textContent).toContain("Something went wrong");
      page.broken = false;
      await render("/dashboard");
      expect(container.textContent).toBe("dashboard");
   });

   it("shows the given fallback and recovers from it on navigation", async () => {
      await render("/a", createElement("p", null, "landing error"));
      expect(container.textContent).toBe("landing error");
      page.broken = false;
      await render("/b", createElement("p", null, "landing error"));
      expect(container.textContent).toBe("dashboard");
   });

   it("falls back again when the next page fails too", async () => {
      await render("/buckets/a");
      await render("/buckets/b");
      expect(container.textContent).toContain("Something went wrong");
   });
});
