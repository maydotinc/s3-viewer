// @vitest-environment happy-dom
import { api } from "@/lib/api";
import { flushUntil } from "@/lib/test/runtime";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";

const h = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));
vi.mock("@/components/Modals/DeleteAccountModal", () => ({
   default: () => createElement("output", null, "delete-account-modal"),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock({ error: h.error })
);

import DangerZoneCard from "./danger-zone-card";

const view = mountedRuntime();
const open = async () => {
   await view.mount(createElement(DangerZoneCard));
   await flushUntil(() =>
      expect(view.current.queryClient.isFetching()).toBe(0)
   );
   return view.current.container;
};
const press = async (container: HTMLElement, until: () => void) => {
   const button = buttonByText(container, "Delete account");
   await act(async () => button!.click());
   await flushUntil(until);
};

beforeEach(() => {
   vi.clearAllMocks();
});

describe("deleting an account whose summary failed to load", () => {
   it("retries on every click instead of repeating the stale failure", async () => {
      const get = vi.mocked(api.get);
      get.mockRejectedValue(new Error("Summary unavailable"));
      const container = await open();
      const loaded = get.mock.calls.length;
      get.mockRejectedValueOnce(
         new Error("Still unavailable")
      ).mockResolvedValue({
         ownedServers: [],
         memberships: 0,
         sentInvites: 0,
         receivedInvites: 0,
      });
      await press(container, () => expect(h.error).toHaveBeenCalled());
      expect(get).toHaveBeenCalledTimes(loaded + 1);
      expect(h.error).toHaveBeenCalledExactlyOnceWith("Still unavailable");
      expect(container.textContent).not.toContain("delete-account-modal");
      await press(container, () =>
         expect(container.textContent).toContain("delete-account-modal")
      );
      expect(get).toHaveBeenCalledTimes(loaded + 2);
      expect(h.error).toHaveBeenCalledOnce();
   });
});
