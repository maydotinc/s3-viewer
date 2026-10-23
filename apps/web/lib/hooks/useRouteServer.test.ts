// @vitest-environment happy-dom
import { mountedRuntime } from "@/components/test-helpers";
import { ApiError } from "@/lib/api";
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   held: new Set<string>(["a", "b"]),
   loading: false,
   failure: null as Error | null,
   refetching: false,
   refetch: vi.fn(),
   session: "",
   listeners: new Set<() => void>(),
   setServerId: vi.fn(),
}));
vi.mock("@/lib/hooks/queries/server/useServerInfo", () => ({
   default: (serverId: string) => {
      const held = !h.loading && !h.failure && h.held.has(serverId);
      return {
         data: held ? { id: serverId } : undefined,
         error: h.failure,
         isLoading: h.loading,
         isMissing: !h.loading && !h.failure && !held,
         isRefetching: h.refetching,
         refetch: h.refetch,
      };
   },
}));
vi.mock("@/lib/stores/session-scope", async () => {
   const { useSyncExternalStore } = await import("react");
   const subscribe = (listener: () => void) => {
      h.listeners.add(listener);
      return () => h.listeners.delete(listener);
   };
   return {
      useServerId: () => useSyncExternalStore(subscribe, () => h.session),
   };
});
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: unknown) => unknown) =>
      select({ setServerId: h.setServerId }),
}));

import { useRouteServer } from "./useRouteServer";

const view = mountedRuntime();
const select = (serverId: string) => {
   h.session = serverId;
   for (const listener of h.listeners) listener();
};
let result!: ReturnType<typeof useRouteServer>;
let open!: (serverId: string) => void;

const Probe = ({ initial }: { initial: string }) => {
   const [serverId, setServerId] = useState(initial);
   open = setServerId;
   result = useRouteServer(serverId);
   return null;
};

beforeEach(() => {
   vi.clearAllMocks();
   h.held = new Set(["a", "b"]);
   h.loading = false;
   h.failure = null;
   h.refetching = false;
   h.session = "";
   h.setServerId.mockImplementation((serverId: string) => {
      if (h.session !== serverId) select(serverId);
   });
});

describe("a bucket URL's server", () => {
   it("becomes the selected server once it is known to be the user's", async () => {
      await view.mount(createElement(Probe, { initial: "a" }));
      expect(result.unavailable).toBe(false);
      expect(result.error).toBeNull();
      expect(h.session).toBe("a");
   });

   it("follows the URL to another held server", async () => {
      await view.mount(createElement(Probe, { initial: "a" }));
      await act(async () => open("b"));
      expect(h.session).toBe("b");
   });

   it("is selected again after an account switch elsewhere reset the selection", async () => {
      await view.mount(createElement(Probe, { initial: "a" }));
      await act(async () => select(""));
      expect(h.session).toBe("a");
      // the session manager falls back to the new account's first server
      await act(async () => select("b"));
      expect(h.session).toBe("a");
   });

   it("is not selected again once the new account doesn't hold it", async () => {
      await view.mount(createElement(Probe, { initial: "a" }));
      h.held = new Set(["b"]);
      await act(async () => select("b"));
      expect(h.session).toBe("b");
      expect(result.unavailable).toBe(true);
   });

   it("is reported unavailable, and never selected, when the user doesn't hold it", async () => {
      await view.mount(createElement(Probe, { initial: "elsewhere" }));
      expect(result.unavailable).toBe(true);
      expect(result.error).toBeNull();
      expect(h.session).toBe("");
   });

   it("is reported unavailable on a refusal", async () => {
      h.failure = new ApiError(403, "no");
      await view.mount(createElement(Probe, { initial: "a" }));
      expect(result.unavailable).toBe(true);
      expect(result.error).toBeNull();
   });

   it.each([
      ["a server error", new ApiError(500, "down")],
      ["a rate limit", new ApiError(429, "slow down")],
      ["a network failure", new ApiError(0, "offline", "NETWORK")],
   ])("offers a retry instead of a dead end on %s", async (_name, failure) => {
      h.failure = failure;
      await view.mount(createElement(Probe, { initial: "a" }));
      expect(result.unavailable).toBe(false);
      expect(result.error).toBe(failure);
      expect(h.session).toBe("");
      result.retry();
      expect(h.refetch).toHaveBeenCalledOnce();
   });

   it("is not judged while it is still loading", async () => {
      h.loading = true;
      await view.mount(createElement(Probe, { initial: "elsewhere" }));
      expect(result.unavailable).toBe(false);
      expect(result.error).toBeNull();
      expect(h.session).toBe("");
   });
});
