import { beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottle, perAddress, perAddressAndIp, perIp } from "./throttle";

const store = vi.hoisted(() => ({
   hit: vi.fn(),
   undo: vi.fn(),
}));
vi.mock("@s3-viewer/db/rate-limit", () => ({
   hitRateLimit: store.hit,
   undoRateLimitHit: store.undo,
}));

beforeEach(() => {
   store.hit.mockReset();
   store.undo.mockReset();
   vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createThrottle", () => {
   it("allows up to the limit inside the window and refuses after", async () => {
      const throttle = createThrottle(2, 1000);
      expect(await throttle.allow("a", 0)).toBe(true);
      expect(await throttle.allow("a", 10)).toBe(true);
      expect(await throttle.allow("a", 20)).toBe(false);
   });

   it("a refused attempt does not extend the window", async () => {
      const throttle = createThrottle(1, 1000);
      expect(await throttle.allow("a", 0)).toBe(true);
      expect(await throttle.allow("a", 900)).toBe(false);
      expect(await throttle.allow("a", 1000)).toBe(true);
   });

   it("starts a fresh window once the first hit's window ends, like the shared store", async () => {
      const throttle = createThrottle(2, 1000);
      expect(await throttle.allow("a", 0)).toBe(true);
      expect(await throttle.allow("a", 900)).toBe(true);
      expect(await throttle.allow("a", 950)).toBe(false);
      expect(await throttle.allow("a", 1000)).toBe(true);
      expect(await throttle.allow("a", 1001)).toBe(true);
      expect(await throttle.allow("a", 1002)).toBe(false);
   });

   it("counts refused attempts, like the shared store", async () => {
      const throttle = createThrottle(1, 1000);
      expect(await throttle.allow("a", 0)).toBe(true);
      expect(await throttle.allow("a", 10)).toBe(false);
      await throttle.refund("a");
      expect(await throttle.allow("a", 20)).toBe(false);
   });

   it("counts one address separately per client ip", async () => {
      const throttle = createThrottle(1, 1000);
      const email = "ada@example.com";
      expect(await throttle.allow(perAddressAndIp("1.1.1.1", email), 0)).toBe(
         true
      );
      expect(await throttle.allow(perAddressAndIp("1.1.1.1", email), 0)).toBe(
         false
      );
      expect(await throttle.allow(perAddressAndIp("2.2.2.2", email), 0)).toBe(
         true
      );
      expect(await throttle.allow(perAddress("2.2.2.2", email), 0)).toBe(true);
   });

   it("keys a source by its address alone and has no key for an unknown source", () => {
      expect(perIp("1.1.1.1")).toBe("1.1.1.1");
      expect(perIp("2001:db8:aa:bb00::/56")).toBe("2001:db8:aa:bb00::/56");
      expect(perIp("")).toBeNull();
   });

   it("caps the keys it remembers, forgetting the least recently seen first", async () => {
      const throttle = createThrottle(1, 60_000);
      for (let i = 0; i < 20_000; i++) await throttle.allow(`k${i}`, 0);
      expect(throttle.size()).toBe(20_000);
      await throttle.allow("one-more", 1);
      expect(throttle.size()).toBe(20_000);
      expect(await throttle.allow("k0", 2)).toBe(true);
      expect(await throttle.allow("k2", 2)).toBe(false);
   });

   it("gives back the most recent hit on refund", async () => {
      const throttle = createThrottle(1, 1000);
      expect(await throttle.allow("a", 0)).toBe(true);
      await throttle.refund("a");
      expect(await throttle.allow("a", 10)).toBe(true);
      expect(await throttle.allow("a", 20)).toBe(false);
      await throttle.refund("never-seen");
   });

   it("sweeps expired keys so memory stays bounded", async () => {
      const throttle = createThrottle(1, 100);
      for (let i = 0; i < 999; i++) await throttle.allow(`k${i}`, 0);
      expect(throttle.size()).toBe(999);
      await throttle.allow("late", 10_000);
      expect(throttle.size()).toBe(1);
   });
});

describe("shared throttle", () => {
   it("counts every replica's hits through the rate_limit table under its own key", async () => {
      const throttle = createThrottle(2, 60_000, {
         name: "sign-in",
         shared: true,
      });
      store.hit
         .mockResolvedValueOnce({ hits: 1, resetAt: new Date() })
         .mockResolvedValueOnce({ hits: 2, resetAt: new Date() })
         .mockResolvedValueOnce({ hits: 3, resetAt: new Date() });
      expect(await throttle.allow("1.1.1.1:ada@example.com")).toBe(true);
      expect(await throttle.allow("1.1.1.1:ada@example.com")).toBe(true);
      expect(await throttle.allow("1.1.1.1:ada@example.com")).toBe(false);
      expect(store.hit).toHaveBeenCalledWith(
         "throttle:sign-in:1.1.1.1:ada@example.com",
         60_000
      );
   });

   it("refuses rather than passing traffic through when the database is unavailable", async () => {
      const throttle = createThrottle(2, 60_000, {
         name: "sign-in",
         shared: true,
      });
      store.hit.mockRejectedValue(new Error("connection refused"));
      expect(await throttle.allow("k")).toBe(false);
   });

   it("refunds through the rate_limit table and survives a failed refund", async () => {
      const throttle = createThrottle(2, 60_000, {
         name: "sign-in",
         shared: true,
      });
      await throttle.refund("k");
      expect(store.undo).toHaveBeenCalledWith("throttle:sign-in:k");
      store.undo.mockRejectedValueOnce(new Error("connection refused"));
      await expect(throttle.refund("k")).resolves.toBeUndefined();
   });

   it("stays in memory unless asked to share", async () => {
      const throttle = createThrottle(1, 60_000, {
         name: "sign-in",
         shared: false,
      });
      expect(await throttle.allow("k")).toBe(true);
      expect(store.hit).not.toHaveBeenCalled();
   });
});
