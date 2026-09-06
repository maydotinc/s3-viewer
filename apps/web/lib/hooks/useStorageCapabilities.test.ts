import { describe, expect, it, vi } from "vitest";
import { useStorageCapabilities } from "./useStorageCapabilities";
const state = vi.hoisted(() => ({ currentServer: null as unknown }));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => state,
}));

describe("storage capabilities", () => {
   it.each([null, { provider: "S3" }, { provider: "Other" }])(
      "disables mutations when capabilities are missing: %j",
      (server) => {
         state.currentServer = server;
         expect(useStorageCapabilities()).toMatchObject({
            upload: false,
            replace: false,
            rename: false,
            delete: false,
         });
      }
   );
   it("uses the API's specific capability flags", () => {
      const capabilities = {
         upload: false,
         replace: false,
         rename: false,
         delete: false,
         notice: "B2 is browse-only",
      };
      state.currentServer = { provider: "Other", capabilities };
      expect(useStorageCapabilities()).toBe(capabilities);
   });
});
