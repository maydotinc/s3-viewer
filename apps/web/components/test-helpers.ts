import { mountRuntime } from "@/lib/test/runtime";
import {
   Provider,
   Role,
   type SentInvite,
   type ServerInfo,
} from "@s3-viewer/types";
import { createElement, type ReactNode } from "react";
import { afterEach, vi, type Mock } from "vitest";

// shared by component tests; the name keeps it out of vitest's `*.test.ts` glob

const passthrough = ({ children }: { children?: ReactNode }) =>
   createElement("div", null, children);

const passthroughDialog = () => ({
   Dialog: passthrough,
   DialogBody: passthrough,
   DialogContent: passthrough,
   DialogDescription: passthrough,
   DialogFooter: passthrough,
   DialogHeader: passthrough,
   DialogTitle: passthrough,
});

const checkboxButton = () => ({
   Checkbox: (props: {
      id: string;
      checked: boolean;
      disabled?: boolean;
      onCheckedChange: (checked: boolean) => void;
   }) =>
      createElement("button", {
         id: props.id,
         type: "button",
         role: "checkbox",
         "aria-checked": props.checked,
         disabled: props.disabled,
         onClick: () => props.onCheckedChange(!props.checked),
      }),
});

type ToastKind = "success" | "error" | "warning" | "info";

const toastMock = (spies: Partial<Record<ToastKind, Mock>> = {}) => ({
   toast: {
      success: spies.success ?? vi.fn(),
      error: spies.error ?? vi.fn(),
      warning: spies.warning ?? vi.fn(),
      info: spies.info ?? vi.fn(),
   },
});

const serverInfo = (overrides: Partial<ServerInfo> = {}): ServerInfo => ({
   id: "server",
   name: "Storage",
   provider: Provider.S3,
   userRole: Role.OWNER,
   capabilities: {
      writable: true,
      deleteProtection: "checked",
      notice: null,
   },
   canCreateBucket: true,
   canRemoveBuckets: true,
   audit: {
      enabled: false,
      canView: false,
      canManage: false,
      canVerify: false,
   },
   ...overrides,
});

const sentInvite = (email: string, emailed = true): SentInvite => ({
   id: email,
   email,
   emailed,
   role: Role.VIEWER,
   expiresAt: "2099-01-01T00:00:00Z",
   server: { id: "server", name: "Storage" },
   invitedBy: { name: "Me", email: "me@example.com" },
   bucketAccess: [],
});

type Match = "exact" | "prefix" | "includes";

const matches = (text: string, wanted: string, match: Match) =>
   match === "exact"
      ? text === wanted
      : match === "prefix"
        ? text.startsWith(wanted)
        : text.includes(wanted);

const buttonByText = (
   container: ParentNode,
   text: string,
   match: Match = "exact"
): HTMLButtonElement | undefined =>
   [...container.querySelectorAll("button")].find((button) =>
      matches(button.textContent ?? "", text, match)
   );

type Runtime = Awaited<ReturnType<typeof mountRuntime>>;

// registers the unmount in the calling test file and replaces any earlier mount; `after` runs once it is gone
const mountedRuntime = (after?: () => void) => {
   let runtime: Runtime | undefined;
   afterEach(async () => {
      await runtime?.unmount();
      runtime?.queryClient.clear();
      runtime = undefined;
      // mountRuntime stubs the act flag, and tests stub their own globals beside it
      vi.unstubAllGlobals();
      after?.();
   });
   return {
      mount: async (children: ReactNode) => {
         await runtime?.unmount();
         runtime = await mountRuntime(children);
         return runtime;
      },
      get current(): Runtime {
         if (!runtime) throw new Error("Nothing is mounted.");
         return runtime;
      },
      text: () => runtime?.container.textContent ?? "",
   };
};

// React tracks the value on the instance setter, so only the prototype setter lets onChange see a change
const typeInto = (
   field: HTMLInputElement | HTMLTextAreaElement,
   value: string
) => {
   const prototype =
      field instanceof HTMLTextAreaElement
         ? HTMLTextAreaElement.prototype
         : HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
   field.dispatchEvent(new Event("input", { bubbles: true }));
};

const submitForm = (container: ParentNode) =>
   container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

export {
   buttonByText,
   checkboxButton,
   mountedRuntime,
   passthroughDialog,
   sentInvite,
   serverInfo,
   submitForm,
   toastMock,
   typeInto,
};
