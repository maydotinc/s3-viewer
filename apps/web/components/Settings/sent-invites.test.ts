// @vitest-environment happy-dom
import { api } from "@/lib/api";
import { flushRuntime } from "@/lib/test/runtime";
import { Role, type ServerInvite } from "@s3-viewer/types";
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";

const h = vi.hoisted(() => ({
   email: "disabled" as "enabled" | "disabled" | "loading",
   revoke: vi.fn(),
}));

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));
vi.mock("@/lib/hooks/queries/useInstanceConfig", () => ({
   default: () => ({}),
   emailState: () => h.email,
}));
vi.mock("@/lib/hooks/mutations/invites/useRevokeInvite", () => ({
   default: () => ({ isPending: false, mutate: h.revoke }),
}));
vi.mock("./invite-people", () => ({ default: () => null }));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: (props: { confirmLabel: string; onConfirm: () => void }) =>
      createElement(
         "div",
         { role: "dialog" },
         createElement("button", { onClick: props.onConfirm }, "Confirm")
      ),
}));

import SentInvites from "./sent-invites";

const invite: ServerInvite = {
   id: "invite",
   email: "guest@example.com",
   server: { id: "server", name: "Backups" },
   role: Role.VIEWER,
   invitedBy: { name: "Owner", email: "owner@example.com" },
   expiresAt: "2099-01-01T00:00:00Z",
   bucketAccess: [],
};

const view = mountedRuntime();
const card = async () => {
   await view.mount(createElement(SentInvites));
   await flushRuntime();
   await flushRuntime();
   return view.current.container;
};

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(api.get).mockResolvedValue({
      invites: [invite],
      nextCursor: "older",
   });
});

describe("sent invites on an instance without email", () => {
   it("explains that no more can be sent, and still lists the live ones", async () => {
      h.email = "disabled";
      const container = await card();
      expect(container.textContent).toContain("no email configured");
      expect(container.textContent).toContain("guest@example.com");
      expect(container.textContent).toContain("Load more invites");
   });

   it("still lets the sender revoke them, once confirmed", async () => {
      h.email = "disabled";
      const container = await card();
      const revoke = container.querySelector<HTMLButtonElement>(
         'button[aria-label="Revoke invite for guest@example.com"]'
      );
      await act(async () => revoke!.click());
      expect(h.revoke).not.toHaveBeenCalled();
      const confirm = container.querySelector<HTMLButtonElement>(
         "[role=dialog] button"
      );
      await act(async () => confirm!.click());
      expect(h.revoke).toHaveBeenCalledExactlyOnceWith(
         { serverId: "server", inviteId: "invite" },
         expect.objectContaining({ onSuccess: expect.any(Function) })
      );
   });

   it("shows no notice when email works", async () => {
      h.email = "enabled";
      const container = await card();
      expect(container.textContent).not.toContain("no email configured");
      expect(container.textContent).toContain("guest@example.com");
   });
});
