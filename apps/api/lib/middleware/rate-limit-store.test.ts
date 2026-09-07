import type { Options } from "express-rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
   hit: vi.fn(),
   undo: vi.fn(),
   reset: vi.fn(),
}));

vi.mock("@s3-viewer/db/rate-limit", () => ({
   hitRateLimit: db.hit,
   undoRateLimitHit: db.undo,
   resetRateLimit: db.reset,
}));

const { postgresStore } = await import("./rate-limit-store");

const started = (prefix: string, windowMs = 60_000) => {
   const store = postgresStore(prefix);
   store.init?.({ windowMs } as Options);
   return store;
};

describe("postgresStore", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("counts a hit against the prefixed key and the limiter's window", async () => {
      const resetAt = new Date("2026-09-06T12:00:00.000Z");
      db.hit.mockResolvedValue({ hits: 3, resetAt });
      const store = started("auth:", 90_000);

      await expect(store.increment("1.2.3.4")).resolves.toEqual({
         totalHits: 3,
         resetTime: resetAt,
      });
      expect(db.hit).toHaveBeenCalledWith("auth:1.2.3.4", 90_000);
   });

   it("prefixes decrement and reset too", async () => {
      const store = started("signup:");
      await store.decrement("user1");
      await store.resetKey("user1");
      expect(db.undo).toHaveBeenCalledWith("signup:user1");
      expect(db.reset).toHaveBeenCalledWith("signup:user1");
   });

   it("declares shared keys so the library allows one instance per limiter", () => {
      const store = started("exists:");
      expect(store.localKeys).toBe(false);
      expect(store.prefix).toBe("exists:");
      expect(postgresStore("exists:")).not.toBe(store);
   });

   it("surfaces a database failure instead of allowing the request", async () => {
      db.hit.mockRejectedValue(new Error("down"));
      await expect(started("auth:").increment("k")).rejects.toThrow("down");
   });
});
