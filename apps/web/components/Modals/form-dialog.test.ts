import { button, click, one, text } from "@/lib/test/elements";
import { DialogFooter } from "@s3-viewer/ui/components/dialog";
import { describe, expect, it, vi } from "vitest";
import { FormDialog } from "./form-dialog";

const render = (props: { isPending: boolean; onAbort?: () => void }) =>
   FormDialog({
      onClose: vi.fn(),
      title: "Copy",
      description: "Copy objects",
      onSubmit: vi.fn(),
      submitLabel: "Copy",
      ...props,
   });

const footer = (tree: unknown) =>
   one(tree, (element) => element.type === DialogFooter, "dialog footer");

const footerText = (tree: unknown) => text(footer(tree));

describe("form dialog abort", () => {
   it("puts Cancel in the always-visible footer while a request runs", () => {
      const onAbort = vi.fn();
      const tree = render({ isPending: true, onAbort });
      click(button(footer(tree), "Cancel"));
      expect(onAbort).toHaveBeenCalledOnce();
   });

   it("shows no Cancel when idle or when the request can't be aborted", () => {
      expect(
         footerText(render({ isPending: false, onAbort: vi.fn() }))
      ).not.toContain("Cancel");
      expect(footerText(render({ isPending: true }))).not.toContain("Cancel");
   });
});
