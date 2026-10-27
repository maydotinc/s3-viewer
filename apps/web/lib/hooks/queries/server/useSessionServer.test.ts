// @vitest-environment happy-dom
import { api } from "@/lib/api";
import useSessionStore from "@/lib/stores/session-store";
import { queryKeys } from "@/lib/query-keys";
import { deferred, flushRuntime, mountRuntime } from "@/lib/test/runtime";
import { serverNamed } from "@/components/test-helpers";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSessionServer from "./useSessionServer";

const h = vi.hoisted(() => ({ pending: false }));
vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({
         data: { user: { id: "user" } },
         isPending: h.pending,
      }),
   },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { get: vi.fn() },
}));

let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
let result!: ReturnType<typeof useSessionServer>;
const Probe = () => {
   result = useSessionServer();
   return null;
};

beforeEach(() => {
   h.pending = false;
   vi.mocked(api.get).mockReset();
   useSessionStore.setState({ userId: "user", serverId: "" });
});
afterEach(async () => {
   await runtime?.unmount();
   runtime = undefined;
});

describe("the selected server alone", () => {
   it("loads only the selected server's details", async () => {
      useSessionStore.setState({ serverId: "picked" });
      vi.mocked(api.get).mockResolvedValue({ server: serverNamed("picked") });
      runtime = await mountRuntime(createElement(Probe));
      expect(result.isLoading).toBe(true);
      await flushRuntime();
      expect(result).toEqual({
         currentServer: serverNamed("picked"),
         isLoading: false,
      });
      expect(
         new Set(vi.mocked(api.get).mock.calls.map(([path]) => path))
      ).toEqual(new Set(["/servers/picked"]));
   });

   it("waits for the session before reporting anything", async () => {
      h.pending = true;
      useSessionStore.setState({ serverId: "picked" });
      runtime = await mountRuntime(createElement(Probe));
      expect(result).toEqual({ currentServer: null, isLoading: true });
      expect(api.get).not.toHaveBeenCalled();
   });

   it("stays loading while the server list that picks a server is in flight", async () => {
      runtime = await mountRuntime(createElement(Probe));
      expect(result.isLoading).toBe(false);
      const list = deferred<unknown>();
      const fetching = runtime.queryClient.fetchInfiniteQuery({
         queryKey: queryKeys.servers("user"),
         queryFn: () => list.promise,
         initialPageParam: null,
      });
      await flushRuntime();
      expect(result).toEqual({ currentServer: null, isLoading: true });
      list.resolve({ servers: [], nextCursor: null });
      await fetching;
      await flushRuntime();
      expect(result.isLoading).toBe(false);
   });
});
