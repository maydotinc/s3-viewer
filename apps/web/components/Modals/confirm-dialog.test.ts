import { all, one } from "@/lib/test/elements";
import { DialogBody } from "@s3-viewer/ui/components/dialog";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

const render = (props: Partial<Parameters<typeof ConfirmDialog>[0]>) =>
   ConfirmDialog({
      onClose: vi.fn(),
      title: "Delete",
      description: "Delete the server",
      confirmLabel: "Delete",
      onConfirm: vi.fn(),
      ...props,
   });

const bodies = (tree: unknown) =>
   all(tree, (element) => element.type === DialogBody);

describe("confirm dialog body", () => {
   it("renders no body for an empty children slot", () => {
      expect(bodies(render({ children: false }))).toHaveLength(0);
      expect(bodies(render({ children: null }))).toHaveLength(0);
      expect(bodies(render({ children: "" }))).toHaveLength(0);
      expect(bodies(render({ children: "Body" }))).toHaveLength(1);
      expect(bodies(render({ error: "Failed" }))).toHaveLength(1);
   });
});

describe("confirm dialog form", () => {
   it("confirms from a submit event instead of the button's click", () => {
      const onConfirm = vi.fn();
      const tree = render({ form: true, onConfirm, children: "Body" });
      const form = one(tree, (element) => element.type === "form", "form");
      const preventDefault = vi.fn();
      (form.props.onSubmit as (event: unknown) => void)({ preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(onConfirm).toHaveBeenCalledOnce();
      const submit = one(
         tree,
         (element) => element.props.type === "submit",
         "submit button"
      );
      expect(submit.props.onClick).toBeUndefined();
   });
});
