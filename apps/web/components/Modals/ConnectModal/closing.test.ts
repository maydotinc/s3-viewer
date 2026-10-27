// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   mountedRuntime,
   submitForm,
   typeInto,
} from "@/components/test-helpers";
import { deferred } from "@/lib/test/runtime";
import ConnectModal from "./index";

const h = vi.hoisted(() => ({
   encrypt: vi.fn(),
   establish: vi.fn(),
   create: vi.fn(),
   creating: false,
   close: vi.fn(),
   openChange: (_open: boolean) => {},
   closeButton: true as boolean | undefined,
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({ data: { encryptionPublicKey: "key" } }),
   encryptionState: () => "ready",
   ENCRYPTION_ERROR: "Encryption failed",
}));
vi.mock("@/lib/utils/encryption", () => ({ encryptCredentials: h.encrypt }));
vi.mock("@/lib/hooks/mutations/server/useEstablishConnection", () => ({
   default: () => ({ mutateAsync: h.establish, isPending: false }),
}));
vi.mock("@/lib/hooks/mutations/server/useCreateServer", () => ({
   default: () => ({ mutateAsync: h.create, isPending: h.creating }),
}));
vi.mock("@/lib/hooks/mutations/server/useValidateBuckets", () => ({
   default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@s3-viewer/ui/components/dialog", () => {
   const element = ({ children }: { children: React.ReactNode }) =>
      createElement("div", null, children);
   return {
      Dialog: ({
         children,
         onOpenChange,
      }: {
         children: React.ReactNode;
         onOpenChange: (open: boolean) => void;
      }) => {
         h.openChange = onOpenChange;
         return createElement("div", null, children);
      },
      DialogBody: element,
      DialogContent: ({
         children,
         showCloseButton,
      }: {
         children: React.ReactNode;
         showCloseButton?: boolean;
      }) => {
         h.closeButton = showCloseButton;
         return createElement("div", null, children);
      },
      DialogDescription: element,
      DialogFooter: element,
      DialogHeader: element,
      DialogTitle: element,
   };
});

const view = mountedRuntime();
const input = (id: string) =>
   view.current.container.querySelector<HTMLInputElement>(`#${id}`)!;
const type = async (id: string, value: string) =>
   act(async () => typeInto(input(id), value));
const submit = async () =>
   act(async () => {
      submitForm(view.current.container);
   });
const open = async () => {
   await view.mount(createElement(ConnectModal, { onClose: h.close }));
   await type("connect-name", "Production");
   await type("connect-endpoint", "https://s3.example.com");
   await type("connect-access-key", "key");
   await type("connect-secret-key", "secret");
};

beforeEach(() => {
   vi.clearAllMocks();
   h.creating = false;
   h.encrypt.mockResolvedValue("encrypted");
});

describe("closing the dialog", () => {
   it("can be dismissed while a slow detection is still running", async () => {
      h.establish.mockReturnValue(deferred().promise);
      await open();
      await submit();
      expect(h.establish).toHaveBeenCalledOnce();
      expect(input("connect-name").disabled).toBe(true);
      expect(h.closeButton).toBe(true);
      h.openChange(false);
      expect(h.close).toHaveBeenCalledOnce();
   });

   it("stays open while the server is being created, which cannot be cancelled", async () => {
      h.creating = true;
      await open();
      expect(h.closeButton).toBe(false);
      h.openChange(false);
      expect(h.close).not.toHaveBeenCalled();
   });
});
