import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";

const storage = createMemoryStorage();
const { memory } = storage;
beforeEach(() => {
   vi.resetModules();
   memory.clear();
   vi.stubGlobal("localStorage", storage);
   vi.stubGlobal("window", { localStorage: storage });
});
const load = async () => {
   const { default: session } = await import("@/lib/stores/session-store");
   const { default: commands } = await import("./store");
   return { session, commands };
};

describe("account command history", () => {
   it("erases A's resource identifiers before B signs in", async () => {
      const { session, commands } = await load();
      session.getState().setUserId("a");
      commands.getState().remember("bucket:private-a");
      commands.getState().remember("server:private-a");
      expect(commands.getState().recentIds).toHaveLength(2);
      session.getState().clearSession();
      expect(memory.get("command-menu-storage")).not.toContain("private-a");
      session.getState().setUserId("b");
      expect(commands.getState().recentIds).toEqual([]);
      commands.getState().remember("bucket:private-b");
      expect(commands.getState().recentIds).toEqual(["bucket:private-b"]);
   });
   it("clears direct account changes and keeps active-user ranking", async () => {
      const { session, commands } = await load();
      session.getState().setUserId("a");
      commands.getState().remember("bucket:first");
      commands.getState().remember("bucket:second");
      commands.getState().remember("bucket:first");
      session.getState().setUserId("a");
      expect(commands.getState().recentIds).toEqual([
         "bucket:first",
         "bucket:second",
      ]);
      session.getState().setUserId("b");
      expect(memory.get("command-menu-storage")).not.toContain("bucket:");
   });
   it("discards persisted recents whose owner differs from the current session", async () => {
      memory.set(
         "session-storage",
         JSON.stringify({ state: { userId: "b", serverId: "" }, version: 0 })
      );
      memory.set(
         "command-menu-storage",
         JSON.stringify({
            state: { userId: "a", recentIds: ["bucket:private-a"] },
            version: 1,
         })
      );
      const { commands } = await load();
      expect(commands.getState().recentIds).toEqual([]);
      expect(memory.get("command-menu-storage")).not.toContain("private-a");
   });
   it("keeps the stored owner's recents across reloads", async () => {
      memory.set(
         "session-storage",
         JSON.stringify({ state: { userId: "a", serverId: "" }, version: 0 })
      );
      memory.set(
         "command-menu-storage",
         JSON.stringify({
            state: { userId: "a", recentIds: ["bucket:kept"] },
            version: 1,
         })
      );
      const { commands } = await load();
      expect(commands.getState().recentIds).toEqual(["bucket:kept"]);
   });
});
