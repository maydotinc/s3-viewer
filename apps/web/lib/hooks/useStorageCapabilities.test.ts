import { describe, expect, it, vi } from "vitest";
import { useStorageCapabilities } from "./useStorageCapabilities";
const state = vi.hoisted(() => ({
   currentServer: null as unknown,
   isLoading: false,
}));
vi.mock("@/lib/hooks/queries/server/useCurrentServer", () => ({
   default: () => state,
}));
vi.mock("react", async (importOriginal) => ({
   ...(await importOriginal<typeof import("react")>()),
   useMemo: (factory: () => unknown) => factory(),
}));

describe("storage capabilities", () => {
   it.each([null, { provider: "S3" }, { provider: "Other" }])(
      "disables mutations when capabilities are missing: %j",
      (server) => {
         state.isLoading = false;
         state.currentServer = server;
         expect(useStorageCapabilities()).toMatchObject({
            upload: false,
            replace: false,
            rename: false,
            delete: false,
            pending: false,
         });
      }
   );
   it("uses the API's specific capability flags", () => {
      state.isLoading = false;
      const capabilities = {
         upload: false,
         replace: false,
         rename: false,
         delete: false,
         deleteProtection: null,
         notice: "B2 is browse-only",
      };
      state.currentServer = { provider: "Other", capabilities };
      expect(useStorageCapabilities()).toEqual({
         ...capabilities,
         pending: false,
      });
   });
   it("reports no notice while the server list is still loading", () => {
      state.isLoading = true;
      state.currentServer = null;
      expect(useStorageCapabilities()).toEqual({
         upload: false,
         replace: false,
         rename: false,
         delete: false,
         deleteProtection: null,
         notice: null,
         pending: true,
      });
   });
});
