// @vitest-environment happy-dom
import { ApiError } from "@/lib/api";
import { mountRuntime } from "@/lib/test/runtime";
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText } from "@/components/test-helpers";
import ObjectEditor from "./editor";

const h = vi.hoisted(() => ({
   session: { userId: "user-a", serverId: "server-a" },
   mutate: vi.fn(),
   data: { text: "original", eTag: '"v1"' },
   saving: false,
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign(
      (selector: (state: typeof h.session) => unknown) => selector(h.session),
      { getState: () => h.session }
   ),
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/hooks/queries/s3/useObjectContent", () => ({
   default: () => ({ data: h.data, isPending: false }),
}));
vi.mock("@/lib/hooks/mutations/object/useSaveObjectContent", () => ({
   default: () => ({ mutate: h.mutate, isPending: h.saving }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);

type Props = Parameters<typeof ObjectEditor>[0];
const initialProps: Props = {
   bucketName: "bucket-a",
   objectKey: "config.json",
   fileName: "config.json",
   contentType: "text/plain",
   onClose: () => {},
};
let setProps!: (props: Props) => void;
const Harness = () => {
   const [props, set] = useState(initialProps);
   setProps = set;
   return createElement(ObjectEditor, props);
};

let runtime!: Awaited<ReturnType<typeof mountRuntime>>;
const textarea = () => runtime.container.querySelector("textarea")!;
const button = (label: string) =>
   buttonByText(runtime.container, label, "includes")!;
const alert = () => runtime.container.querySelector('[role="alert"]');
const edit = async (text: string) => {
   await act(async () => {
      Object.getOwnPropertyDescriptor(
         HTMLTextAreaElement.prototype,
         "value"
      )!.set!.call(textarea(), text);
      textarea().dispatchEvent(new Event("input", { bubbles: true }));
   });
};
const save = () => act(async () => button("Save").click());
const pressSave = async () => {
   const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
   });
   await act(async () => {
      runtime.container.querySelector("section")!.dispatchEvent(event);
   });
   return event;
};

beforeEach(async () => {
   vi.clearAllMocks();
   h.session = { userId: "user-a", serverId: "server-a" };
   h.data = { text: "original", eTag: '"v1"' };
   h.saving = false;
   runtime = await mountRuntime(createElement(Harness));
});
afterEach(async () => {
   await runtime.unmount();
   runtime.queryClient.clear();
   vi.unstubAllGlobals();
});

describe("editor target identity", () => {
   it("saves the reviewed draft and ETag to its original target", async () => {
      await edit("updated");
      await save();
      expect(h.mutate).toHaveBeenCalledWith(
         expect.objectContaining({
            ...h.session,
            bucketName: "bucket-a",
            objectKey: "config.json",
            text: "updated",
            expectedETag: '"v1"',
         }),
         expect.any(Object)
      );
   });

   it.each(["user", "server", "bucket", "key"])(
      "refuses a retained draft after the %s changes",
      async (field) => {
         await edit("updated");
         if (field === "user") h.session = { ...h.session, userId: "user-b" };
         if (field === "server")
            h.session = { ...h.session, serverId: "server-b" };
         await act(async () => {
            if (field === "bucket")
               setProps({ ...initialProps, bucketName: "bucket-b" });
            if (field === "key")
               setProps({ ...initialProps, objectKey: "other.json" });
         });
         await edit("retained draft");
         await save();
         expect(h.mutate).not.toHaveBeenCalled();
         expect(alert()?.textContent).toContain("editing target changed");
      }
   );

   it("uses the same scope checks for keyboard Save", async () => {
      await edit("updated");
      expect((await pressSave()).defaultPrevented).toBe(true);
      expect(h.mutate).toHaveBeenCalledOnce();
      h.mutate.mockClear();
      h.session = { ...h.session, serverId: "server-b" };
      expect((await pressSave()).defaultPrevented).toBe(true);
      expect(h.mutate).not.toHaveBeenCalled();
   });

   it("refuses a save before React rerenders an account or server change", async () => {
      await edit("updated");
      h.session = { userId: "user-a", serverId: "server-b" };
      await save();
      expect(h.mutate).not.toHaveBeenCalled();
   });
});

describe("editor saving", () => {
   it("does not write an unchanged file from the keyboard", async () => {
      await edit("draft");
      await edit("original");
      await pressSave();
      expect(h.mutate).not.toHaveBeenCalled();
      await edit("updated");
      await pressSave();
      expect(h.mutate).toHaveBeenCalledOnce();
   });

   it("keeps the textarea focusable and blocks Cancel while a save runs", async () => {
      await edit("updated");
      h.saving = true;
      await edit("updated twice");
      expect(textarea().readOnly).toBe(true);
      expect(textarea().disabled).toBe(false);
      expect(button("Cancel").disabled).toBe(true);
      expect(button("Save").getAttribute("aria-busy")).toBe("true");
   });

   it("keeps a save conflict visible while the user keeps editing", async () => {
      h.mutate.mockImplementation(
         (_input, callbacks: { onError: (error: unknown) => void }) =>
            callbacks.onError(new ApiError(409, "Precondition failed"))
      );
      await edit("updated");
      await save();
      await edit("updated again");
      expect(alert()?.textContent).toContain("Changed since you opened it");
   });
});

describe("editor gutter limits", () => {
   it("omits a million-line gutter without changing the editable or saved contents", async () => {
      const gutter = () =>
         runtime.container.querySelector('div[aria-hidden="true"]');
      const text = "\n".repeat(1024 * 1024);
      await edit(text);
      expect(gutter()).toBeNull();
      expect(textarea().value).toBe(text);
      await save();
      expect(h.mutate).toHaveBeenCalledWith(
         expect.objectContaining({ text }),
         expect.any(Object)
      );
      await edit("one\ntwo");
      expect(gutter()?.textContent).toBe("1\n2");
   });
});
