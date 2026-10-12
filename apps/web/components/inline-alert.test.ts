import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InlineAlert from "./inline-alert";

type Props = Parameters<typeof InlineAlert>[0];

const render = (props: Props) =>
   renderToStaticMarkup(createElement(InlineAlert, props));

describe("inline alert variants", () => {
   it("announces the message in a panel with its action beside it", () => {
      const html = render({
         children: "List failed",
         action: createElement("button", null, "Try again"),
      });
      expect(html).toContain('role="alert"');
      expect(html).toContain("List failed");
      expect(html).toContain("Try again");
      expect(html).toContain("bg-viewerbgred/60");
   });

   it("renders a plain row without a box and wraps long text", () => {
      const html = render({ variant: "plain", children: "Page failed" });
      expect(html).toMatch(/^<p role="alert"/);
      expect(html).not.toContain("bg-viewerbgred");
      expect(html).toContain("[overflow-wrap:anywhere]");
      expect(html).not.toContain('title="Page failed"');
   });

   it("truncates to one line and keeps the whole message as a tooltip", () => {
      const html = render({
         variant: "plain",
         truncate: true,
         children: "Page failed",
      });
      expect(html).toContain('title="Page failed"');
      expect(html).toContain('class="min-w-0 truncate">Page failed</span>');
   });

   it("stacks a title above the detail and action", () => {
      const html = render({
         title: "Couldn't load buckets",
         children: "Access denied",
         action: createElement("button", null, "Try again"),
      });
      expect(html).toContain('role="alert"');
      expect(html).toContain("Couldn&#x27;t load buckets");
      expect(html).toContain('title="Access denied"');
      expect(html).toContain("Try again");
   });
});
