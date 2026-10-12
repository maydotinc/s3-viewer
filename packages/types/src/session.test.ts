import { describe, expect, it } from "vitest";
import { HOUR_MS, SESSION_FRESH_HOURS } from "./constants";
import { isSessionFresh } from "./session";

describe("session freshness", () => {
   const now = Date.UTC(2026, 8, 20);
   const boundary = now - SESSION_FRESH_HOURS * HOUR_MS;

   it("accepts valid timestamps strictly inside the freshness window", () => {
      expect(isSessionFresh(now, now)).toBe(true);
      expect(isSessionFresh(new Date(boundary + 1), now)).toBe(true);
      expect(isSessionFresh(new Date(boundary + 1).toISOString(), now)).toBe(
         true
      );
   });

   it("tolerates a server clock ahead of the client's clock", () => {
      expect(isSessionFresh(now + HOUR_MS, now)).toBe(true);
   });

   it("rejects the boundary, old, and invalid timestamps", () => {
      for (const timestamp of [boundary, boundary - 1, NaN, "invalid"]) {
         expect(isSessionFresh(timestamp, now)).toBe(false);
      }
   });
});
