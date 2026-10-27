import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InlineAlert from "./inline-alert";

type Props = Parameters<typeof InlineAlert>[0];

const render = (props: Props) =>
   renderToStaticMarkup(createElement(InlineAlert, props));

describe("inline alert variants", () => {
   it("keeps the whole message as a tooltip only when a plain row truncates", () => {
      const plain = { variant: "plain", children: "Page failed" } as const;
      expect(render(plain)).not.toContain('title="Page failed"');
      expect(render({ ...plain, truncate: true })).toContain(
         'title="Page failed"'
      );
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
