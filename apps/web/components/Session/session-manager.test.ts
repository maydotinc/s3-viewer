// @vitest-environment happy-dom
import useSessionStore from "@/lib/stores/session-store";
import { mountRuntime } from "@/lib/test/runtime";
import { act, createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   authUserId: "user" as string | null,
   result: {
      servers: [] as { id: string }[],
      isServerListLoading: false,
      isCurrentServerMissing: false,
      serverListError: null as Error | null,
   },
}));

vi.mock("@/lib/auth", () => ({
   authClient: {
      useSession: () => ({
         data: h.authUserId ? { user: { id: h.authUserId } } : null,
      }),
   },
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => h.result,
}));

import SessionManager from "./session-manager";

let rerender: () => Promise<void>;
const Harness = () => {
   const [, setVersion] = useState(0);
   rerender = () => act(async () => setVersion((version) => version + 1));
   return createElement(SessionManager);
};

let runtime: Awaited<ReturnType<typeof mountRuntime>> | undefined;
const mount = async () => {
   runtime = await mountRuntime(createElement(Harness));
};
const serverId = () => useSessionStore.getState().serverId;

beforeEach(() => {
   useSessionStore.persist.setOptions({
      storage: {
         getItem: () => null,
         setItem: () => undefined,
         removeItem: () => undefined,
      },
   });
   useSessionStore.setState({ userId: "user", serverId: "selected" });
   h.authUserId = "user";
   h.result = {
      servers: [],
      isServerListLoading: false,
      isCurrentServerMissing: false,
      serverListError: null,
   };
});
afterEach(async () => {
   await runtime?.unmount();
   runtime = undefined;
   useSessionStore.getState().clearSession();
});

describe("session server reconciliation", () => {
   it.each([
      { page: "first", servers: [], next: "" },
      { page: "later", servers: [{ id: "first" }], next: "first" },
   ])(
      "preserves selection after a $page-page error until recovery",
      async (test) => {
         h.result = {
            ...h.result,
            servers: test.servers,
            serverListError: new Error("Listing failed"),
         };
         await mount();
         expect(serverId()).toBe("selected");
         h.result = {
            ...h.result,
            serverListError: null,
            isCurrentServerMissing: true,
         };
         await rerender();
         expect(serverId()).toBe(test.next);
      }
   );

   it("waits for an available first page before reconciling confirmed removal", async () => {
      h.result = {
         ...h.result,
         servers: [{ id: "first" }],
         isServerListLoading: true,
      };
      await mount();
      expect(serverId()).toBe("selected");
      h.result = {
         ...h.result,
         isServerListLoading: false,
         isCurrentServerMissing: true,
      };
      await rerender();
      expect(serverId()).toBe("first");
   });

   it("retains a selection found on a later successful page", async () => {
      h.result = {
         ...h.result,
         servers: [{ id: "first" }],
         isServerListLoading: true,
      };
      await mount();
      h.result = {
         ...h.result,
         servers: [{ id: "first" }, { id: "selected" }],
         isServerListLoading: false,
      };
      await rerender();
      expect(serverId()).toBe("selected");
   });

   it.each([null, "another-user"])(
      "does not reconcile a list outside the current user scope: %s",
      async (authUserId) => {
         h.authUserId = authUserId;
         h.result = {
            ...h.result,
            servers: [{ id: "first" }],
            isCurrentServerMissing: true,
         };
         await mount();
         expect(serverId()).toBe("selected");
      }
   );
});
