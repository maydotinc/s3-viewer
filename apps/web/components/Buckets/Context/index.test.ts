// @vitest-environment happy-dom
import {
   act,
   createElement,
   useState,
   type FC,
   type PropsWithChildren,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountedRuntime } from "@/components/test-helpers";
import { queryKeys } from "@/lib/query-keys";
import { QueryClient } from "@tanstack/react-query";
import { BucketProvider, useBucketContext, useBucketFilter } from "./index";

const h = vi.hoisted(() => ({
   refetch: vi.fn(),
   serverRole: "OWNER",
   bucketsLoading: false,
}));
vi.mock("@/lib/auth", () => ({
   authClient: { useSession: () => ({ data: { user: { id: "user" } } }) },
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: { serverId: string }) => unknown) =>
      select({ serverId: "server" }),
   useUserId: () => "user",
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => {
      const server = { id: "server", userRole: h.serverRole };
      return { servers: [server], currentServer: server, isLoading: false };
   },
}));
vi.mock("@/lib/hooks/queries/s3/useBuckets", () => ({
   default: () => ({
      currentBucket: { name: "bucket", userRole: "OWNER", folders: null },
      isBucketsLoading: h.bucketsLoading,
      bucketsError: null,
      isFetching: false,
      refetch: h.refetch,
   }),
}));

type Seen = { prefix: string; filter: string };
const view = mountedRuntime();
let seen: Seen[] = [];
let navigate!: (path: string[]) => void;
let context!: ReturnType<typeof useBucketContext>;
let filter!: ReturnType<typeof useBucketFilter>;

const Provider = BucketProvider as FC<
   PropsWithChildren<{ bucketName: string; path: string[] }>
>;
const Consumer = () => {
   context = useBucketContext();
   filter = useBucketFilter();
   seen.push({ prefix: context.prefix, filter: filter.filter });
   return null;
};
const Probe = () => {
   const [path, setPath] = useState(["a"]);
   navigate = setPath;
   return createElement(
      Provider,
      { bucketName: "bucket", path },
      createElement(Consumer)
   );
};
const mount = async () => {
   await view.mount(createElement(Probe));
};

beforeEach(() => {
   vi.clearAllMocks();
   seen = [];
   h.serverRole = "OWNER";
   h.bucketsLoading = false;
});

describe("the prefix filter across navigation", () => {
   it("is already empty on the first render of another folder", async () => {
      await mount();
      await act(async () => filter.setFilter("rep"));
      expect(filter.filter).toBe("rep");
      seen = [];
      await act(async () => navigate(["a", "reports"]));
      expect(seen.length).toBeGreaterThan(0);
      expect(seen).not.toContainEqual({ prefix: "a/reports/", filter: "rep" });
      expect(filter.filter).toBe("");
   });

   it("stays cleared when someone returns to the folder they filtered", async () => {
      await mount();
      await act(async () => filter.setFilter("rep"));
      await act(async () => navigate(["a", "reports"]));
      seen = [];
      await act(async () => navigate(["a"]));
      expect(seen).not.toContainEqual({ prefix: "a/", filter: "rep" });
      expect(filter.filter).toBe("");
   });

   it("applies a filter set after navigating to the folder now open", async () => {
      await mount();
      const setFilter = filter.setFilter;
      await act(async () => navigate(["b"]));
      expect(filter.setFilter).toBe(setFilter);
      await act(async () => setFilter("x"));
      expect(seen.at(-1)).toEqual({ prefix: "b/", filter: "x" });
   });
});

describe("waiting for a member's folder access", () => {
   it("holds the listing for a member until their buckets load, but never for the owner", async () => {
      h.bucketsLoading = true;
      h.serverRole = "EDITOR";
      await mount();
      expect(context).toMatchObject({ reach: undefined, awaitingReach: true });
      await view.current.unmount();
      h.serverRole = "OWNER";
      await mount();
      expect(context).toMatchObject({ reach: undefined, awaitingReach: false });
      await view.current.unmount();
      h.bucketsLoading = false;
      h.serverRole = "EDITOR";
      await mount();
      expect(context.awaitingReach).toBe(false);
      expect(context.reach).toBeDefined();
   });
});

describe("refreshing", () => {
   it("reloads only the listing for mutations and the bucket list and server info too for a full refresh", async () => {
      const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
      await mount();
      const reload = vi.fn();
      context.registerRefresh(reload);
      context.reloadListing();
      expect(reload).toHaveBeenCalledOnce();
      expect(h.refetch).not.toHaveBeenCalled();
      context.refresh();
      expect(reload).toHaveBeenCalledTimes(2);
      expect(h.refetch).toHaveBeenCalledOnce();
      expect(invalidate).toHaveBeenCalledExactlyOnceWith({
         queryKey: queryKeys.serverInfo("user", "server"),
      });
      invalidate.mockRestore();
   });
});

describe("files dropped outside a drop zone", () => {
   const drag = (type: string, types: string[], handled = false) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const dataTransfer = { types, dropEffect: "copy" };
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      if (handled) event.preventDefault();
      document.body.dispatchEvent(event);
      return { event, dataTransfer };
   };

   it.each(["dragover", "drop"])(
      "do not navigate the tab away on %s",
      async (type) => {
         await mount();
         const { event, dataTransfer } = drag(type, ["Files"]);
         expect(event.defaultPrevented).toBe(true);
         expect(dataTransfer.dropEffect).toBe("none");
      }
   );

   it("leaves a drop zone's own handling and its copy cursor alone", async () => {
      await mount();
      expect(drag("dragover", ["Files"], true).dataTransfer.dropEffect).toBe(
         "copy"
      );
   });

   it("ignores drags that carry no files", async () => {
      await mount();
      expect(drag("drop", ["text/plain"]).event.defaultPrevented).toBe(false);
   });

   it("stops guarding once the bucket pages are left", async () => {
      await mount();
      await view.current.unmount();
      expect(drag("drop", ["Files"]).event.defaultPrevented).toBe(false);
   });
});
