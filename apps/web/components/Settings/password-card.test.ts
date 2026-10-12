// @vitest-environment happy-dom
import { act, createElement } from "react";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSessionStore from "@/lib/stores/session-store";
import { deferred, flushRuntime, mountRuntime } from "@/lib/test/runtime";
import { queryKeys } from "@/lib/query-keys";
import PasswordCard from "./password-card";

const h = vi.hoisted(() => ({
   hasPassword: true,
   changePassword: vi.fn(),
   setPassword: vi.fn(),
   success: vi.fn(),
   fields: new Map<
      string,
      {
         value: string;
         onChange: (event: { target: { value: string } }) => void;
      }
   >(),
}));

vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({ data: { session: { createdAt: new Date() } } }),
   },
   changePassword: h.changePassword,
   setPassword: h.setPassword,
   signOut: vi.fn(),
}));
vi.mock("@/lib/hooks/queries/user/useHasPassword", () => ({
   useHasPassword: () => ({
      data: h.hasPassword,
      isLoading: false,
      error: null,
   }),
}));
vi.mock("@/components/Auth/password-input", () => ({
   default: (props: {
      id: string;
      value: string;
      onChange: (event: { target: { value: string } }) => void;
   }) => {
      h.fields.set(props.id, props);
      return createElement("input", props);
   },
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ success: h.success })
);

const mounted: Awaited<ReturnType<typeof mountRuntime>>[] = [];
const mountCard = async () => {
   const runtime = await mountRuntime(createElement(PasswordCard));
   mounted.push(runtime);
   return runtime;
};
const fillAndSubmit = async (
   runtime: Awaited<ReturnType<typeof mountCard>>
) => {
   await act(async () => {
      h.fields
         .get("current-password")
         ?.onChange({ target: { value: "Current-pass-123" } });
      h.fields
         .get("new-password")!
         .onChange({ target: { value: "Next-pass-456" } });
   });
   await act(async () => {
      runtime.container
         .querySelector("form")!
         .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
         );
   });
};

beforeEach(() => {
   useSessionStore.persist.setOptions({
      storage: {
         getItem: () => null,
         setItem: () => undefined,
         removeItem: () => undefined,
      },
   });
   vi.clearAllMocks();
   h.fields.clear();
   h.hasPassword = true;
   h.changePassword.mockResolvedValue({ error: null });
   h.setPassword.mockResolvedValue(undefined);
   useSessionStore.getState().setUserId("account-a");
   onlineManager.setOnline(true);
});
afterEach(async () => {
   onlineManager.setOnline(true);
   for (const runtime of mounted.splice(0)) {
      await runtime.unmount();
      runtime.queryClient.clear();
   }
   useSessionStore.getState().clearSession();
   vi.unstubAllGlobals();
});

describe.each([true, false])(
   "password mutation with hasPassword=%s",
   (hasPassword) => {
      it.each([true, false])(
         "refuses a queued previous-account password write after unmount=%s",
         async (unmount) => {
            h.hasPassword = hasPassword;
            onlineManager.setOnline(false);
            const runtime = await mountCard();
            const invalidate = vi.spyOn(
               runtime.queryClient,
               "invalidateQueries"
            );
            await fillAndSubmit(runtime);
            expect(
               runtime.queryClient.getMutationCache().getAll()[0]!.state
                  .isPaused
            ).toBe(true);
            if (unmount) await runtime.unmount();
            await act(async () =>
               useSessionStore.getState().setUserId("account-b")
            );
            if (!unmount) {
               expect(h.fields.get("new-password")!.value).toBe("");
               if (hasPassword)
                  expect(h.fields.get("current-password")!.value).toBe("");
            }
            await act(async () => {
               onlineManager.setOnline(true);
               await runtime.queryClient.resumePausedMutations();
            });
            expect(h.changePassword).not.toHaveBeenCalled();
            expect(h.setPassword).not.toHaveBeenCalled();
            expect(h.success).not.toHaveBeenCalled();
            expect(invalidate).not.toHaveBeenCalled();
            expect(
               runtime.queryClient.getMutationCache().getAll()[0]!.state.error
            ).toMatchObject({ code: "ACCOUNT_CHANGED" });
         }
      );

      it("resumes normally for the same account", async () => {
         h.hasPassword = hasPassword;
         onlineManager.setOnline(false);
         const runtime = await mountCard();
         const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
         await fillAndSubmit(runtime);
         await act(async () => {
            onlineManager.setOnline(true);
            await runtime.queryClient.resumePausedMutations();
         });
         await flushRuntime();
         if (hasPassword) {
            expect(h.changePassword).toHaveBeenCalledWith(
               "Current-pass-123",
               "Next-pass-456"
            );
            expect(h.setPassword).not.toHaveBeenCalled();
         } else {
            expect(h.setPassword).toHaveBeenCalledWith("Next-pass-456");
            expect(h.changePassword).not.toHaveBeenCalled();
         }
         expect(invalidate).toHaveBeenCalledWith({
            queryKey: queryKeys.hasPassword("account-a"),
         });
         expect(invalidate).toHaveBeenCalledWith({
            queryKey: queryKeys.sessions("account-a"),
         });
         expect(h.fields.get("new-password")!.value).toBe("");
         expect(h.success).toHaveBeenCalledWith(
            hasPassword ? "Password updated" : "Password set"
         );
      });

      it("settles an already-started write against its original cache without clearing the new account's form", async () => {
         h.hasPassword = hasPassword;
         const response = deferred<{ error: null }>();
         if (hasPassword) h.changePassword.mockReturnValue(response.promise);
         else
            h.setPassword.mockReturnValue(
               response.promise.then(() => undefined)
            );
         const runtime = await mountCard();
         const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
         await fillAndSubmit(runtime);
         await act(async () =>
            useSessionStore.getState().setUserId("account-b")
         );
         await act(async () =>
            h.fields
               .get("new-password")!
               .onChange({ target: { value: "Account-B-draft-789" } })
         );
         await act(async () => {
            response.resolve({ error: null });
         });
         await flushRuntime();
         expect(invalidate.mock.calls).toEqual([
            [{ queryKey: queryKeys.hasPassword("account-a") }],
            [{ queryKey: queryKeys.sessions("account-a") }],
         ]);
         expect(h.fields.get("new-password")!.value).toBe(
            "Account-B-draft-789"
         );
      });
   }
);
