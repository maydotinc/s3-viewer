// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   mountedRuntime,
   submitForm,
   typeInto,
} from "@/components/test-helpers";
import { deferred } from "@/lib/test/runtime";
import ConnectModal from "./index";

const h = vi.hoisted(() => ({
   userId: "first-user",
   encrypt: vi.fn(),
   establish: vi.fn(),
   validate: vi.fn(),
   create: vi.fn(),
   creating: false,
   close: vi.fn(),
   openChange: (_open: boolean) => {},
   closeButton: true as boolean | undefined,
}));
vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({ data: { user: { emailVerified: true } } }),
   },
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => h.userId }));
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
   default: () => ({ mutateAsync: h.validate, isPending: false }),
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

let switchAccount!: () => void;
const Probe = () => {
   const [, rerender] = useState(0);
   switchAccount = () => {
      h.userId = "second-user";
      rerender((value) => value + 1);
   };
   return createElement(ConnectModal, { onClose: h.close });
};
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
   await view.mount(createElement(Probe));
   await type("connect-name", "First account storage");
   await type("connect-endpoint", "https://s3.example.com");
   await type("connect-access-key", "first-key");
   await type("connect-secret-key", "first-secret");
};

beforeEach(() => {
   vi.clearAllMocks();
   h.userId = "first-user";
   h.creating = false;
   h.encrypt.mockResolvedValue("encrypted-first");
   h.establish.mockResolvedValue({
      provider: "Other",
      listBucketsAllowed: false,
      bucketCount: 0,
   });
});

describe("account changes during connection setup", () => {
   it("drops encryption from the previous account before credential detection", async () => {
      const encrypted = deferred<string>();
      h.encrypt.mockReturnValue(encrypted.promise);
      await open();
      await submit();
      expect(h.encrypt).toHaveBeenCalledOnce();
      expect(input("connect-name").disabled).toBe(true);
      await act(async () => switchAccount());
      expect(input("connect-name").disabled).toBe(false);
      expect(input("connect-name").value).toBe("");
      expect(input("connect-secret-key").value).toBe("");
      await act(async () => encrypted.resolve("encrypted-first"));
      expect(h.establish).not.toHaveBeenCalled();
   });

   it("does not show an old detection result after an account change", async () => {
      const detection = deferred<{
         provider: string;
         listBucketsAllowed: boolean;
         bucketCount: number;
      }>();
      h.establish.mockReturnValue(detection.promise);
      await open();
      await submit();
      expect(h.establish).toHaveBeenCalledOnce();
      await act(async () => switchAccount());
      await act(async () =>
         detection.resolve({
            provider: "Other",
            listBucketsAllowed: true,
            bucketCount: 1,
         })
      );
      expect(view.current.container.textContent).not.toContain("Server found");
      expect(input("connect-name").value).toBe("");
      expect(h.create).not.toHaveBeenCalled();
   });

   it("does not create a connection in a new account after old bucket validation", async () => {
      const validation =
         deferred<{ bucketName: string; accessible: boolean }[]>();
      h.validate.mockReturnValue(validation.promise);
      await open();
      await submit();
      await type("bucket-names", "first-bucket");
      await submit();
      expect(h.validate).toHaveBeenCalledOnce();
      expect(input("bucket-names").disabled).toBe(true);
      await act(async () => switchAccount());
      await act(async () =>
         validation.resolve([{ bucketName: "first-bucket", accessible: true }])
      );
      expect(h.create).not.toHaveBeenCalled();
      expect(input("connect-name").value).toBe("");
   });
});

describe("closing the dialog", () => {
   it("can be dismissed while a slow detection is still running", async () => {
      h.establish.mockReturnValue(deferred().promise);
      await open();
      await submit();
      expect(h.establish).toHaveBeenCalledOnce();
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
