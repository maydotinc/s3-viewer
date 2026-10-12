import { describe, expect, it } from "vitest";
import { timeRange } from "./audit-time";

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);
const HOUR_MS = 60 * 60 * 1000;

describe("time presets", () => {
   it.each([
      ["24h", 24],
      ["7d", 7 * 24],
      ["30d", 30 * 24],
      ["90d", 90 * 24],
   ] as const)("%s reaches back from now as an ISO string", (preset, hours) => {
      expect(timeRange(preset, { from: "", to: "" }, NOW)).toEqual({
         from: new Date(NOW - hours * HOUR_MS).toISOString(),
      });
   });

   it("sets no bounds for any time", () => {
      expect(timeRange("", { from: "", to: "" }, NOW)).toEqual({});
   });

   it("spans whole local days for a custom range", () => {
      expect(
         timeRange("custom", { from: "2026-09-01", to: "2026-09-03" }, NOW)
      ).toEqual({
         from: new Date("2026-09-01T00:00:00.000").toISOString(),
         to: new Date("2026-09-03T23:59:59.999").toISOString(),
      });
   });

   it("drops a custom bound that is blank or not a date", () => {
      expect(timeRange("custom", { from: "", to: "2026-09-03" }, NOW)).toEqual({
         from: undefined,
         to: new Date("2026-09-03T23:59:59.999").toISOString(),
      });
      expect(timeRange("custom", { from: "nope", to: "" }, NOW)).toEqual({
         from: undefined,
         to: undefined,
      });
   });
});
