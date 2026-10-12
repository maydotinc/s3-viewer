import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/head", () => ({
   default: ({ children }: { children: ReactNode }) =>
      createElement(Fragment, null, children),
}));
vi.mock("@/lib/env", () => ({
   publicEnv: { siteOrigin: "https://viewer.example" },
}));
import Seo from "./seo";

const render = (canonical?: string) =>
   renderToStaticMarkup(
      createElement(Seo, {
         title: "Page not found",
         description: "",
         canonical,
      })
   );

describe("page metadata", () => {
   it("points the canonical link at the page it names", () => {
      expect(render("/login")).toContain(
         '<link rel="canonical" href="https://viewer.example/login"/>'
      );
      expect(render("/login")).toContain(
         '<meta property="og:url" content="https://viewer.example/login"/>'
      );
   });

   it("leaves pages without a canonical path from claiming the home page", () => {
      expect(render()).not.toContain("canonical");
      expect(render("")).not.toContain("og:url");
   });
});
