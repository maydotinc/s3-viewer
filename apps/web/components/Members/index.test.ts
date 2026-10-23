// @vitest-environment happy-dom
import {
   buttonByText,
   mountedRuntime,
   serverInfo,
} from "@/components/test-helpers";
import {
   MAX_PENDING_INVITES,
   Role,
   type ServerInfo,
   type ServerInvite,
} from "@s3-viewer/types";
import { act, createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   query: {} as Record<string, string>,
   replace: vi.fn(),
   servers: [] as ServerInfo[],
   currentServer: null as ServerInfo | null,
   isServerListLoading: false,
   serverListError: null as Error | null,
   invites: [] as ServerInvite[],
   refetch: vi.fn(),
}));

const router = {
   pathname: "/settings/members",
   isReady: true,
   get query() {
      return h.query;
   },
   replace: h.replace,
};

vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
   default: ({ href, children }: { href: string; children: ReactNode }) =>
      createElement("a", { href }, children),
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "owner" }));
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));
vi.mock("@s3-viewer/ui/components/tooltip", () => ({
   SimpleTooltip: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({
      servers: h.servers,
      currentServer: h.currentServer,
      isSessionPending: false,
      isServerListLoading: h.isServerListLoading,
      serverListError: h.serverListError,
      hasNextPage: false,
      isFetching: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch: h.refetch,
   }),
}));
vi.mock("@/lib/hooks/queries/s3/useBucketsForServer", () => ({
   default: () => ({ buckets: [], isLoading: false }),
}));
vi.mock("@/lib/hooks/queries/server/useMembers", () => ({
   default: () => ({
      members: [],
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetching: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
   }),
}));
vi.mock("@/lib/hooks/queries/server/useInvites", () => ({
   useSentInvites: () => ({
      data: h.invites,
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
   }),
}));
vi.mock("@/lib/hooks/mutations/invites/useUpdateRole", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/mutations/invites/useRemoveMember", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/mutations/invites/useRevokeInvite", () => ({
   default: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("@/components/Invites/bucket-access-dialog", () => ({
   default: () => null,
}));
vi.mock("@/components/Invites/role-select", () => ({ default: () => null }));
import MembersSettings from "./index";

const owned = serverInfo({ id: "owned", name: "Owned storage" });
const admin = serverInfo({
   id: "admin",
   name: "Admin storage",
   userRole: Role.ADMIN,
});
const viewed = serverInfo({
   id: "viewed",
   name: "Viewed storage",
   userRole: Role.VIEWER,
});

const invite = (id: string): ServerInvite => ({
   id,
   email: `${id}@example.test`,
   server: { id: "owned", name: "Owned storage" },
   role: Role.VIEWER,
   invitedBy: { name: "Owner", email: "owner@example.test" },
   expiresAt: "2099-01-01T00:00:00Z",
   bucketAccess: [],
});

const view = mountedRuntime();
const mount = () => view.mount(createElement(MembersSettings));
const picker = () =>
   view.current.container.querySelector('[aria-label="Server"]')?.textContent ??
   "";
const inviteLink = () =>
   [...view.current.container.querySelectorAll("a")].find(
      (link) => link.textContent === "Invite people"
   );

beforeEach(() => {
   vi.clearAllMocks();
   h.query = {};
   h.servers = [viewed, owned, admin];
   h.currentServer = null;
   h.isServerListLoading = false;
   h.serverListError = null;
   h.invites = [];
});

describe("choosing the server to manage", () => {
   it("follows ?server when that server is manageable", async () => {
      h.query = { server: "admin" };
      await mount();
      expect(picker()).toContain("Admin storage");
      expect(picker()).toContain("Admin");
      expect(inviteLink()?.getAttribute("href")).toBe(
         "/settings/members/invite?server=admin"
      );
      expect(h.replace).not.toHaveBeenCalled();
   });

   it("ignores ?server for a server the user only views and writes the fallback back", async () => {
      h.query = { server: "viewed" };
      await mount();
      expect(picker()).toContain("Owned storage");
      expect(h.replace).toHaveBeenCalledWith(
         "/settings/members?server=owned",
         undefined,
         { shallow: true }
      );
   });

   it("prefers the session server when it is manageable and nothing is requested", async () => {
      h.currentServer = admin;
      await mount();
      expect(picker()).toContain("Admin storage");
   });

   it("falls back to the first manageable server, skipping ones the user only views", async () => {
      await mount();
      expect(picker()).toContain("Owned storage");
      expect(picker()).not.toContain("Viewed storage");
      expect(h.replace).toHaveBeenCalledWith(
         "/settings/members?server=owned",
         undefined,
         { shallow: true }
      );
   });

   it("stays a skeleton without an invite link while the list loads", async () => {
      h.isServerListLoading = true;
      await mount();
      expect(
         view.current.container.querySelector('[aria-label="Server"]')
      ).toBeNull();
      expect(inviteLink()).toBeUndefined();
      expect(view.text()).toContain("Invite people");
      expect(h.replace).not.toHaveBeenCalled();
   });
});

describe("without a server to manage", () => {
   it("explains who can manage members instead of showing the tables", async () => {
      h.servers = [viewed];
      await mount();
      expect(view.text()).toContain("No servers to manage");
      expect(view.text()).toContain(
         "You can manage members on servers where you're an Owner or Admin."
      );
      expect(view.text()).not.toContain("Invite people");
      expect(view.text()).not.toContain("Pending invites");
      expect(h.replace).not.toHaveBeenCalled();
   });

   it("offers a retry when the server list failed", async () => {
      h.servers = [];
      h.serverListError = new Error("Network error");
      await mount();
      expect(view.text()).toContain("Couldn't load your servers");
      expect(view.text()).toContain("Network error");
      await act(async () =>
         buttonByText(view.current.container, "Try again")!.click()
      );
      expect(h.refetch).toHaveBeenCalledOnce();
   });
});

describe("the pending invites tab", () => {
   it("shows how close the server is to the pending cap", async () => {
      h.invites = [invite("a"), invite("b")];
      await mount();
      const tab = buttonByText(
         view.current.container,
         "Pending invites",
         "prefix"
      );
      await act(async () => tab!.click());
      expect(view.text()).toContain(
         `2 of ${MAX_PENDING_INVITES} pending invites`
      );
      expect(view.text()).toContain("a@example.test");
   });
});
