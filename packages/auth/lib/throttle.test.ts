import { beforeEach, describe, expect, it, vi } from "vitest";
import { consoleLogger } from "@s3-viewer/shared";
import { setAuthLogger } from "./log";
import { createThrottle } from "./throttle";

const store = vi.hoisted(() => ({
   hit: vi.fn(),
   undo: vi.fn(),
}));
vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@s3-viewer/db/rate-limit", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@s3-viewer/db/rate-limit")>()),
   sharedWindowCounter: { hit: store.hit, undo: store.undo },
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

   it("caps the keys it remembers, forgetting the least recently seen first", async () => {
      const throttle = createThrottle(1, 60_000);
      for (let i = 0; i < 20_000; i++) await throttle.allow(`k${i}`, 0);
      await throttle.allow("one-more", 1);
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
});

describe("shared throttle", () => {
   it("counts every replica's hits through the rate_limit table under its own key", async () => {
      const throttle = createThrottle(2, 60_000, {
         name: "sign-in",
         shared: true,
      });
      store.hit
         .mockResolvedValueOnce({ hits: 1, resetAt: 0 })
         .mockResolvedValueOnce({ hits: 2, resetAt: 0 })
         .mockResolvedValueOnce({ hits: 3, resetAt: 0 });
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

   it("reports the outage through the logger its host handed over", async () => {
      const error = vi.fn();
      vi.mocked(console.error).mockClear();
      setAuthLogger({ info: vi.fn(), warn: vi.fn(), error });
      const throttle = createThrottle(2, 60_000, {
         name: "sign-in",
         shared: true,
      });
      store.hit.mockRejectedValue(new Error("connection refused"));
      await throttle.allow("k");
      setAuthLogger(consoleLogger);
      expect(error).toHaveBeenCalledWith("Auth throttle unavailable", {
         throttle: "sign-in",
         error: expect.stringContaining("connection refused"),
      });
      expect(console.error).not.toHaveBeenCalled();
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
});
