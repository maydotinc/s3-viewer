// @vitest-environment happy-dom
import { ApiError, api } from "@/lib/api";
import SessionManager from "@/components/Session/session-manager";
import useSessionStore from "@/lib/stores/session-store";
import { queryKeys } from "@/lib/query-keys";
import { deferred, flushRuntime, mountRuntime } from "@/lib/test/runtime";
import {
   Provider,
   Role,
   type ServerInfo,
   type ServerPage,
} from "@s3-viewer/types";
import { act, createElement, Fragment, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useServers from "./useServers";
import useBuckets from "../s3/useBuckets";
import { useServerPage } from "@/lib/hooks/useServerPage";

const h = vi.hoisted(() => ({
   authUserId: "user",
   pending: false,
   replace: vi.fn(),
   push: vi.fn(),
   back: vi.fn(),
}));
vi.mock("next/router", () => ({
   useRouter: () => ({ replace: h.replace, push: h.push, back: h.back }),
}));
vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({
         data: h.authUserId ? { user: { id: h.authUserId } } : null,
         isPending: h.pending,
      }),
   },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));

const server = (id: string): ServerInfo => ({
   id,
   name: id,
   userRole: Role.OWNER,
   provider: Provider.S3,
   audit: { enabled: false, canView: false, canManage: true },
});
const page = (ids: string[], nextCursor: string | null): ServerPage => ({
   servers: ids.map(server),
   nextCursor,
});
let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
let result!: ReturnType<typeof useServers>;
let buckets!: ReturnType<typeof useBuckets>;
let rerender!: () => void;
let pageResult!: ReturnType<typeof useServerPage>;
const PageProbe = () => {
   pageResult = useServerPage({
      serverId: "linked",
      canOpen: (server) => server.userRole === Role.OWNER,
      pathFor: (id) => `/share/${id}`,
   });
   return createElement("output", null, pageResult.server?.name ?? "pending");
};
const Probe = () => {
   const [, update] = useState(0);
   rerender = () => update((v) => v + 1);
   result = useServers();
   buckets = useBuckets();
   return createElement(
      "output",
      null,
      result.currentServer?.name ?? "pending"
   );
};
const mount = async () => {
   runtime = await mountRuntime(
      createElement(
         Fragment,
         null,
         createElement(SessionManager),
         createElement(Probe)
      )
   );
};
const settle = async () => {
   await flushRuntime();
   await flushRuntime();
};
const get = vi.mocked(api.get);

beforeEach(() => {
   useSessionStore.persist.setOptions({
      storage: {
         getItem: () => null,
         setItem: () => undefined,
         removeItem: () => undefined,
      },
   });
   h.authUserId = "user";
   h.pending = false;
   h.replace.mockReset();
   useSessionStore.setState({ userId: "user", serverId: "selected" });
   get.mockReset().mockImplementation(async (path) => {
      if (path === "/servers") return page(["first"], "next");
      if (path.endsWith("/buckets")) return { buckets: [{ name: "bucket" }] };
      if (path.startsWith("/servers/"))
         return { server: server(path.slice("/servers/".length)) };
      throw new Error(`Unexpected request: ${path}`);
   });
});
afterEach(async () => {
   await runtime?.unmount();
   runtime?.queryClient.clear();
   runtime = undefined;
   vi.unstubAllGlobals();
});

describe("selected server and on-demand membership pages", () => {
   it("makes the selected server and its buckets usable while even the first membership page is delayed", async () => {
      const first = deferred<ServerPage>();
      get.mockImplementation(async (path) =>
         path === "/servers"
            ? first.promise
            : path.endsWith("/buckets")
              ? { buckets: [{ name: "bucket" }] }
              : { server: server("selected") }
      );
      await mount();
      await settle();
      expect(result.isServerListLoading).toBe(true);
      expect(result.isLoading).toBe(false);
      expect(result.currentServer?.id).toBe("selected");
      expect(buckets.isBucketsLoading).toBe(false);
      expect(buckets.buckets).toEqual([{ name: "bucket" }]);
      expect(useSessionStore.getState().serverId).toBe("selected");
      await act(async () => first.resolve(page(["first"], "later")));
      await settle();
      expect(result.servers.map(({ id }) => id)).toEqual(["first", "selected"]);
      expect(get.mock.calls.every(([path]) => !path.includes("cursor="))).toBe(
         true
      );
   });

   it("fetches later pages only on demand and retains selection and loaded entries after a failed page", async () => {
      const later = deferred<ServerPage>();
      await mount();
      await settle();
      expect(result.hasNextPage).toBe(true);
      expect(result.isLoading).toBe(false);
      expect(get.mock.calls.every(([path]) => !path.includes("cursor="))).toBe(
         true
      );
      get.mockImplementationOnce(async () => later.promise);
      let fetchPage!: Promise<unknown>;
      await act(async () => {
         fetchPage = result.fetchNextPage();
      });
      await settle();
      expect(result.isFetchingNextPage).toBe(true);
      expect(result.currentServer?.id).toBe("selected");
      expect(result.isLoading).toBe(false);
      await act(async () => {
         later.reject(new Error("Later page failed"));
         await fetchPage;
      });
      await settle();
      expect(result.serverListError?.message).toBe("Later page failed");
      expect(result.serverError).toBeNull();
      expect(result.servers.map(({ id }) => id)).toEqual(["first", "selected"]);
      expect(useSessionStore.getState().serverId).toBe("selected");
      get.mockResolvedValueOnce(page(["later"], null));
      await act(async () => {
         await result.fetchNextPage();
      });
      await settle();
      expect(result.servers.map(({ id }) => id)).toEqual([
         "first",
         "later",
         "selected",
      ]);
      expect(result.hasNextPage).toBe(false);
   });

   it("does not replace the selection when its independent read fails transiently", async () => {
      get.mockImplementation(async (path) => {
         if (path === "/servers") return page(["first"], null);
         if (path.endsWith("/buckets")) return { buckets: [] };
         throw new ApiError(503, "Temporarily unavailable");
      });
      await mount();
      await settle();
      expect(result.serverError?.message).toBe("Temporarily unavailable");
      expect(result.isCurrentServerMissing).toBe(false);
      expect(useSessionStore.getState().serverId).toBe("selected");
   });

   it("removes revoked membership from stale list data and selects an available server after an explicit 404", async () => {
      await mount();
      await settle();
      await act(async () =>
         runtime!.queryClient.setQueryData(queryKeys.servers("user"), {
            pages: [page(["selected", "first"], "next")],
            pageParams: [null],
         })
      );
      get.mockImplementation(async (path) => {
         if (path === "/servers/selected")
            throw new ApiError(404, "Server not found");
         if (path.endsWith("/buckets")) return { buckets: [] };
         return { server: server("first") };
      });
      await act(async () => {
         await runtime!.queryClient.invalidateQueries({
            queryKey: queryKeys.serverInfo("user", "selected"),
         });
      });
      await settle();
      expect(useSessionStore.getState().serverId).toBe("first");
      expect(result.currentServer?.id).toBe("first");
      expect(result.servers.map(({ id }) => id)).not.toContain("selected");
   });

   it("does not cycle between revoked memberships retained in a previously loaded page", async () => {
      get.mockImplementation(async (path) => {
         if (path === "/servers") return page(["selected", "first"], null);
         if (path.endsWith("/buckets")) return { buckets: [] };
         throw new ApiError(404, "Server not found");
      });
      await mount();
      await settle();
      await settle();
      expect(useSessionStore.getState().serverId).toBe("");
      expect(result.servers).toEqual([]);
      expect(
         get.mock.calls.filter(([path]) => path === "/servers/selected").length
      ).toBeLessThanOrEqual(2);
   });

   it("resolves a directly linked server without loading membership pages and waits for a subsequent server switch", async () => {
      runtime = await mountRuntime(createElement(PageProbe));
      await settle();
      expect(pageResult.server?.id).toBe("linked");
      expect(pageResult.allowed).toBe(true);
      expect(useSessionStore.getState().serverId).toBe("linked");
      expect(get.mock.calls.some(([path]) => path === "/servers")).toBe(false);
      const next = deferred<{ server: ServerInfo }>();
      get.mockImplementation(async () => next.promise);
      await act(async () => useSessionStore.getState().setServerId("next"));
      await settle();
      expect(h.replace).not.toHaveBeenCalled();
      await act(async () => next.resolve({ server: server("next") }));
      await settle();
      expect(h.replace).toHaveBeenCalledWith("/share/next");
   });

   it("keeps the selected server's fresh role instead of its stale page copy", async () => {
      await mount();
      await settle();
      await act(async () =>
         runtime!.queryClient.setQueryData(
            queryKeys.serverInfo("user", "selected"),
            { ...server("selected"), userRole: Role.VIEWER }
         )
      );
      await act(async () =>
         runtime!.queryClient.setQueryData(queryKeys.servers("user"), {
            pages: [page(["selected"], null)],
            pageParams: [null],
         })
      );
      await settle();
      expect(result.currentServer?.userRole).toBe(Role.VIEWER);
      expect(result.servers.find(({ id }) => id === "selected")?.userRole).toBe(
         Role.VIEWER
      );
   });

   it("switches to a known server outside the loaded page without walking the list", async () => {
      await mount();
      await settle();
      await act(async () => useSessionStore.getState().setServerId("outside"));
      await settle();
      expect(result.currentServer?.id).toBe("outside");
      expect(useSessionStore.getState().serverId).toBe("outside");
      expect(get.mock.calls.some(([path]) => path === "/servers/outside")).toBe(
         true
      );
      expect(get.mock.calls.every(([path]) => !path.includes("cursor="))).toBe(
         true
      );
   });

   it("isolates cached data from an account change and waits for the matching session", async () => {
      await mount();
      await settle();
      h.authUserId = "other";
      await act(async () => rerender());
      await settle();
      expect(result.currentServer).toBeNull();
      expect(result.servers).toEqual([]);
      await act(async () => {
         useSessionStore.getState().setUserId("other");
         useSessionStore.getState().setServerId("other-server");
      });
      await settle();
      expect(result.currentServer?.id).toBe("other-server");
      expect(
         runtime!.queryClient.getQueryData(
            queryKeys.serverInfo("other", "other-server")
         )
      ).toMatchObject({ id: "other-server" });
   });

   it("waits for session resolution before requesting either membership metadata query", async () => {
      h.pending = true;
      await mount();
      await settle();
      expect(get.mock.calls.every(([path]) => path.endsWith("/buckets"))).toBe(
         true
      );
      h.pending = false;
      await act(async () => rerender());
      await settle();
      expect(result.currentServer?.id).toBe("selected");
   });
});
