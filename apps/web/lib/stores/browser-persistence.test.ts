import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";

const loadStores = async () => {
   const { default: session } = await import("./session-store");
   const { default: preferences } = await import("./preferences-store");
   const { default: commands } = await import("../command-menu/store");
   return { session, preferences, commands };
};

beforeEach(() => {
   vi.resetModules();
});

afterEach(() => {
   vi.unstubAllGlobals();
});

describe("browser persistence", () => {
   it("initializes on a server with a methodless localStorage global", async () => {
      vi.stubGlobal("window", undefined);
      vi.stubGlobal("localStorage", {});

      const { session, preferences, commands } = await loadStores();

      expect(session.getState()).toMatchObject({ serverId: "", userId: null });
      expect(preferences.getState().foldersFirst).toBe(true);
      expect(commands.getState()).toMatchObject({
         open: false,
         recentIds: [],
         userId: null,
      });
   });

   it("hydrates browser settings and account history after a reload", async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal("window", { localStorage: storage });
      vi.stubGlobal("localStorage", {});

      const { session, preferences, commands } = await loadStores();
      session.getState().setUserId("user-1");
      session.getState().setServerId("server-1");
      preferences.getState().setFoldersFirst(false);
      commands.getState().remember("bucket:photos");
      commands.getState().openMenu();

      vi.resetModules();
      const reloaded = await loadStores();

      expect(reloaded.session.getState()).toMatchObject({
         userId: "user-1",
         serverId: "server-1",
      });
      expect(reloaded.preferences.getState().foldersFirst).toBe(false);
      expect(reloaded.commands.getState()).toMatchObject({
         userId: "user-1",
         recentIds: ["bucket:photos"],
         open: false,
      });
      expect(reloaded.session.persist.hasHydrated()).toBe(true);
      expect(reloaded.preferences.persist.hasHydrated()).toBe(true);
      expect(reloaded.commands.persist.hasHydrated()).toBe(true);
   });
});
