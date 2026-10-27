// @vitest-environment happy-dom
import useSessionStore from "@/lib/stores/session-store";
import { mountedRuntime } from "@/components/test-helpers";
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
afterEach(() => useSessionStore.getState().clearSession());
// registered after the cleanup above so the manager unmounts before the session clears
const view = mountedRuntime();
const mount = () => view.mount(createElement(Harness));

describe("session server reconciliation", () => {
   it.each([
      {
         blocker: "a first-page error",
         pending: { serverListError: new Error("Listing failed") },
         servers: [],
         next: "",
      },
      {
         blocker: "a later-page error",
         pending: { serverListError: new Error("Listing failed") },
         servers: [{ id: "first" }],
         next: "first",
      },
      {
         blocker: "the first page loading",
         pending: { isServerListLoading: true },
         servers: [{ id: "first" }],
         next: "first",
      },
   ])(
      "keeps a removed selection through $blocker until it clears",
      async ({ pending, servers, next }) => {
         h.result = {
            ...h.result,
            ...pending,
            servers,
            isCurrentServerMissing: true,
         };
         await mount();
         expect(serverId()).toBe("selected");
         h.result = {
            ...h.result,
            serverListError: null,
            isServerListLoading: false,
         };
         await rerender();
         expect(serverId()).toBe(next);
      }
   );

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
