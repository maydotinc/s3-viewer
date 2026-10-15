// @vitest-environment happy-dom
import { api } from "@/lib/api";
import { flushRuntime } from "@/lib/test/runtime";
import { Role, type ServerInvite } from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import ReceivedInvites from "./received-invites";

vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));
vi.mock("@/lib/hooks/mutations/invites/useAcceptInvite", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/mutations/invites/useRejectInvite", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));

const view = mountedRuntime();

describe("received invites with a filtered first page", () => {
   it.each([true, false])(
      "checks older pages before showing an empty account (older invite: %s)",
      async (hasOlderInvite) => {
         const invite: ServerInvite = {
            id: "older",
            email: "user@example.com",
            server: { id: "server", name: "Older server" },
            role: Role.VIEWER,
            invitedBy: { name: "Owner", email: "owner@example.com" },
            expiresAt: "2099-01-01T00:00:00Z",
            bucketAccess: [],
         };
         vi.mocked(api.get)
            .mockReset()
            .mockImplementation(async (path) =>
               path.includes("cursor=older")
                  ? {
                       invites: hasOlderInvite ? [invite] : [],
                       nextCursor: null,
                    }
                  : { invites: [], nextCursor: "older" }
            );
         await view.mount(createElement(ReceivedInvites));
         await flushRuntime();
         await flushRuntime();
         expect(view.current.container.textContent).toContain(
            "Load more to check for older invites"
         );
         expect(view.current.container.textContent).not.toContain(
            "No invites waiting for you"
         );
         const more = [
            ...view.current.container.querySelectorAll("button"),
         ].find((button) => button.textContent === "Load more invites");
         expect(more).toBeDefined();
         await act(async () => more!.click());
         await flushRuntime();
         await flushRuntime();
         expect(view.current.container.textContent).toContain(
            hasOlderInvite ? "Older server" : "No invites waiting for you"
         );
         expect(view.current.container.textContent).not.toContain(
            "Load more invites"
         );
      }
   );
});
