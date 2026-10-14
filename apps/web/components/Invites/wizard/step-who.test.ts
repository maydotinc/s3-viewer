// @vitest-environment happy-dom
import { mountedRuntime } from "@/components/test-helpers";
import { flushRuntime } from "@/lib/test/runtime";
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_EMAIL_FIELD, canContinue, type EmailField } from "./email-chips";
import StepWho from "./step-who";

const h = vi.hoisted(() => ({
   onContinue: vi.fn(),
   value: undefined as EmailField | undefined,
}));

const Host = ({ initial }: { initial: EmailField }) => {
   const [value, setValue] = useState(initial);
   h.value = value;
   return createElement(StepWho, {
      value,
      canContinue: canContinue(value),
      onChange: setValue,
      onContinue: h.onContinue,
   });
};

const view = mountedRuntime();
const setValue = Object.getOwnPropertyDescriptor(
   HTMLInputElement.prototype,
   "value"
)!.set!;

const mount = async (initial = EMPTY_EMAIL_FIELD) => {
   await view.mount(createElement(Host, { initial }));
   return view.current.container;
};
const input = () => view.current.container.querySelector("input")!;
const type = async (text: string) => {
   await act(async () => {
      setValue.call(input(), text);
      input().dispatchEvent(new Event("input", { bubbles: true }));
   });
};
const press = async (key: string) => {
   await act(async () => {
      input().dispatchEvent(
         new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
   });
   await flushRuntime();
};
const paste = async (text: string) => {
   const event = new Event("paste", { bubbles: true, cancelable: true });
   Object.defineProperty(event, "clipboardData", {
      value: { getData: () => text },
   });
   await act(async () => {
      input().dispatchEvent(event);
   });
};
const chips = () =>
   [...view.current.container.querySelectorAll("li > span")].map(
      (chip) => chip.textContent
   );
const helper = () => view.current.container.querySelector("p")!;

beforeEach(() => vi.clearAllMocks());

describe("typing addresses", () => {
   it("turns the typed text into a chip on Enter", async () => {
      await mount();
      await type("A@x.com");
      await press("Enter");
      expect(chips()).toEqual(["a@x.com"]);
      expect(input().value).toBe("");
      expect(h.onContinue).not.toHaveBeenCalled();
   });

   it("asks for an address when Enter is pressed with nothing typed", async () => {
      await mount();
      await press("Enter");
      expect(helper().textContent).toBe("Enter at least one email address");
      expect(helper().getAttribute("role")).toBe("alert");
   });

   it("continues on Enter once there are chips and the input is empty", async () => {
      await mount({ ...EMPTY_EMAIL_FIELD, chips: ["a@x.com"] });
      await press("Enter");
      expect(h.onContinue).toHaveBeenCalledOnce();
   });

   it("pulls the last chip back into the input on Backspace", async () => {
      await mount({ ...EMPTY_EMAIL_FIELD, chips: ["a@x.com", "b@x.com"] });
      await press("Backspace");
      expect(chips()).toEqual(["a@x.com"]);
      expect(input().value).toBe("b@x.com");
   });
});

describe("pasting a list", () => {
   it("splits it into chips", async () => {
      await mount();
      await paste("a@x.com, b@x.com; c@x.com");
      expect(chips()).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
      expect(input().value).toBe("");
   });

   it("keeps what would go past the limit in the input and explains", async () => {
      await mount({ ...EMPTY_EMAIL_FIELD, chips: ["a@x.com", "b@x.com"] });
      await paste("c@x.com d@x.com e@x.com f@x.com g@x.com");
      expect(chips()).toHaveLength(5);
      expect(input().value).toBe("f@x.com, g@x.com");
      expect(helper().textContent).toBe(
         "You can invite up to 5 people at a time"
      );
      expect(view.current.container.textContent).toContain("5 of 5");
   });
});

describe("the chips", () => {
   it("marks an invalid one and blocks continuing until it is removed", async () => {
      const container = await mount();
      await type("nope");
      await press("Enter");
      expect(helper().textContent).toBe("Check the highlighted addresses");
      expect(
         container.querySelector('li [title="Not a valid email address"]')
      ).not.toBeNull();
      expect(h.value && canContinue(h.value)).toBe(false);
      await act(async () =>
         container
            .querySelector<HTMLButtonElement>(
               'button[aria-label="Remove nope"]'
            )!
            .click()
      );
      expect(chips()).toEqual([]);
   });

   it("does not add a duplicate, and says so without an alert", async () => {
      await mount({ ...EMPTY_EMAIL_FIELD, chips: ["a@x.com"] });
      await type("A@X.COM");
      await press("Enter");
      expect(chips()).toEqual(["a@x.com"]);
      expect(helper().textContent).toBe("a@x.com is already in the list");
      expect(helper().getAttribute("role")).toBeNull();
   });
});
