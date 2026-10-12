import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import QueryStatus from "./query-status";

type Props = Parameters<typeof QueryStatus>[0];

const render = (props: Props) =>
   renderToStaticMarkup(
      createElement(QueryStatus, props, createElement("p", null, "Loaded"))
   );

describe("query status", () => {
   it("shows the error with a retry over anything else", () => {
      const html = render({
         error: new Error("Boom"),
         loading: true,
         title: "Couldn't load",
         onRetry: () => undefined,
      });
      expect(html).toContain('role="alert"');
      expect(html).toContain("Couldn&#x27;t load");
      expect(html).toContain("Boom");
      expect(html).toContain("Try again");
      expect(html).not.toContain("Loaded");
      expect(html).not.toContain('role="status"');
   });

   it("accepts a bare message and omits the retry when none is wired", () => {
      const html = render({ error: "Lost", title: "Couldn't load" });
      expect(html).toContain("Lost");
      expect(html).not.toContain("Try again");
   });

   it("spins while loading and then yields to its children", () => {
      const loading = render({
         error: null,
         loading: true,
         loadingLabel: "Loading things",
         loadingClassName: "h-full",
         title: "Couldn't load",
      });
      expect(loading).toContain('aria-label="Loading things"');
      expect(loading).toContain("h-full");
      expect(loading).not.toContain("Loaded");
      expect(render({ error: null, title: "Couldn't load" })).toBe(
         "<p>Loaded</p>"
      );
   });
});
