import { mountRuntime } from "@/lib/test/runtime";
import { Provider, Role, type ServerInfo } from "@s3-viewer/types";
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
   audit: { enabled: false, canView: false, canManage: false },
   ...overrides,
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

export {
   buttonByText,
   mountedRuntime,
   passthroughDialog,
   serverInfo,
   toastMock,
};
