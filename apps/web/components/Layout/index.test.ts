// @vitest-environment happy-dom
import { mountedRuntime } from "@/components/test-helpers";
import { SITE_PATHS } from "@s3-viewer/types";
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   serverId: "a",
   query: {} as Record<string, string>,
   push: vi.fn(),
}));
vi.mock("next/router", () => ({
   useRouter: () => ({ push: h.push, query: h.query }),
}));
vi.mock("@/lib/stores/session-scope", () => ({
   useServerId: () => h.serverId,
}));
vi.mock("@/lib/stores/upload-store/upload-store", () => ({
   default: (select: (state: { order: string[] }) => unknown) =>
      select({ order: [] }),
}));
vi.mock("@s3-viewer/ui/components/sidebar", () => ({
   useSidebar: () => ({ openMobile: false }),
}));
vi.mock("@/components/Layout/Banner/banner", () => ({ default: () => null }));
vi.mock("./sidebar", () => ({ ViewerSidebar: () => null }));
vi.mock("./upload-progress", () => ({ default: () => null }));

import ViewerLayout from "./index";

const view = mountedRuntime();
let rerender!: () => void;

const Host = () => {
   const [, setTick] = useState(0);
   rerender = () => setTick((tick) => tick + 1);
   return createElement(ViewerLayout, null, null);
};

const selectServer = async (serverId: string) => {
   h.serverId = serverId;
   await act(async () => rerender());
};

beforeEach(() => {
   vi.clearAllMocks();
   h.serverId = "a";
   h.query = {};
});

describe("switching servers under the viewer layout", () => {
   it("leaves a page that belongs to the previous server for the dashboard", async () => {
      await view.mount(createElement(Host));
      await selectServer("b");
      expect(h.push).toHaveBeenCalledExactlyOnceWith(SITE_PATHS.dashboard);
   });

   it("stays on a page whose URL named the server it switched to", async () => {
      h.query = { serverId: "b" };
      await view.mount(createElement(Host));
      await selectServer("b");
      expect(h.push).not.toHaveBeenCalled();
   });

   it("still leaves that page when a different server is selected", async () => {
      h.query = { serverId: "a" };
      await view.mount(createElement(Host));
      await selectServer("c");
      expect(h.push).toHaveBeenCalledExactlyOnceWith(SITE_PATHS.dashboard);
   });
});
