// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   buttonByText,
   mountedRuntime,
   serverInfo,
   submitForm,
   typeInto,
} from "@/components/test-helpers";
import { deferred, flushRuntime } from "@/lib/test/runtime";
import { ApiError } from "@/lib/api";
import { ErrorCode } from "@s3-viewer/types";
import Modal from "./index";

const h = vi.hoisted(() => ({
   encrypt: vi.fn(),
   mutate: vi.fn(),
   signOut: vi.fn(),
   error: null as unknown,
}));

vi.mock("@s3-viewer/ui/components/dialog", async () =>
   (await import("@/components/test-helpers")).passthroughDialog()
);
vi.mock("@/lib/hooks/mutations/server/useUpdateCredentials", () => ({
   default: () => ({ isPending: false, mutate: h.mutate, error: h.error }),
}));
vi.mock("@/lib/auth", () => ({ signOut: h.signOut }));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({ data: { encryptionPublicKey: "key" } }),
   ENCRYPTION_ERROR: "Couldn't encrypt",
   encryptionState: () => "ready",
}));
vi.mock("@/lib/utils/encryption", () => ({ encryptCredentials: h.encrypt }));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user1" }));

const view = mountedRuntime();
const type = async (id: string, value: string) =>
   act(async () =>
      typeInto(
         view.current.container.querySelector<HTMLInputElement>(
            `#update-credentials-${id}`
         )!,
         value
      )
   );
const submit = async () => act(async () => submitForm(view.current.container));
const save = () =>
   view.current.container.querySelector<HTMLButtonElement>(
      "button[type=submit]"
   )!;

beforeEach(() => {
   vi.clearAllMocks();
   h.error = null;
});

describe("updating credentials", () => {
   it("treats encryption as pending so a second submit can't send the keys twice", async () => {
      const sealed = deferred<string>();
      h.encrypt.mockReturnValue(sealed.promise);
      await view.mount(
         createElement(Modal, {
            server: serverInfo({ id: "server1" }),
            onClose: vi.fn(),
         })
      );
      await type("endpoint", "https://s3.example.com");
      await type("access-key", "access");
      await type("secret-key", "secret");
      await submit();
      expect(save().disabled).toBe(true);
      expect(save().getAttribute("aria-busy")).toBe("true");
      await submit();
      expect(h.encrypt).toHaveBeenCalledOnce();
      await act(async () => sealed.resolve("sealed"));
      await flushRuntime();
      expect(h.mutate).toHaveBeenCalledOnce();
      expect(h.mutate.mock.calls[0]?.[0]).toEqual({
         serverId: "server1",
         encryptedCredentials: "sealed",
      });
      expect(save().disabled).toBe(false);
   });

   it("asks for a fresh sign-in instead of showing the stale-session error", async () => {
      h.encrypt.mockResolvedValue("sealed");
      h.mutate.mockImplementation((_input, { onError }) => {
         h.error = new ApiError(403, "Stale", ErrorCode.SESSION_STALE);
         onError(h.error);
      });
      await view.mount(
         createElement(Modal, {
            server: serverInfo({ id: "server1" }),
            onClose: vi.fn(),
         })
      );
      await type("endpoint", "https://s3.example.com");
      await type("access-key", "access");
      await type("secret-key", "secret");
      await submit();
      await flushRuntime();
      const text = view.current.container.textContent ?? "";
      expect(text).toContain("Sign in again to replace these credentials");
      expect(text).not.toContain("Stale");
      await act(async () =>
         buttonByText(view.current.container, "Sign in again")!.click()
      );
      expect(h.signOut).toHaveBeenCalledOnce();
      expect(h.mutate).toHaveBeenCalledOnce();
   });
});
