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
   it("disables mutations when server info is unavailable", () => {
      state.isLoading = false;
      state.currentServer = null;
      expect(useStorageCapabilities()).toMatchObject({
         writable: false,
         pending: false,
      });
   });
   it("uses the API's capabilities", () => {
      state.isLoading = false;
      const capabilities = {
         writable: true,
         deleteProtection: "checked",
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
         writable: false,
         deleteProtection: null,
         notice: null,
         pending: true,
      });
   });
});
