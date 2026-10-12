import { serverInfo } from "@/components/test-helpers";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ result: {} as Record<string, unknown> }));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => h.result,
}));
vi.mock("@/lib/hooks/useSwitchServer", () => ({
   useSwitchServer: () => vi.fn(),
}));
vi.mock("@/lib/contexts/modal-context", () => ({
   useModalActions: () => ({ open: vi.fn() }),
}));
vi.mock("@/lib/stores/session-store", () => ({ useUserId: () => "user" }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import ServerSelect from "./server-select";
const selected = serverInfo({
   id: "selected",
   name: "Selected storage",
   audit: { enabled: false, canManage: true, canView: false },
});
const render = () => renderToStaticMarkup(createElement(ServerSelect));
beforeEach(() => {
   h.result = {
      servers: [],
      currentServer: null,
      isLoading: false,
      serverError: null,
      serverListError: null,
      hasNextPage: false,
      isFetching: false,
   };
});
describe("paged server picker", () => {
   it("renders the selected server even while the membership list is loading", () => {
      Object.assign(h.result, {
         currentServer: selected,
         servers: [selected],
         isServerListLoading: true,
      });
      expect(render()).toContain("Selected storage");
      expect(render()).toContain(
         'aria-label="Switch server, current: Selected storage"'
      );
   });
   it("keeps the picker reachable when known revoked servers exhaust the loaded page but more pages remain", () => {
      h.result.hasNextPage = true;
      expect(render()).toContain("Choose a server");
      expect(render()).toContain('aria-label="Switch server"');
   });
   it("keeps the picker reachable after a membership-page error", () => {
      h.result.serverListError = new Error("List failed");
      expect(render()).toContain("Choose a server");
   });
   it("offers connection only when there are no available or remaining servers", () => {
      expect(render()).toContain("Add server");
      expect(render()).not.toContain('aria-label="Switch server"');
   });
});
