import { HOUR_MS } from "@s3-viewer/types";
import type { AuditFilters } from "@/lib/query-keys";

type TimePreset = "" | "24h" | "7d" | "30d" | "90d" | "custom";
type TimeRange = Pick<AuditFilters, "from" | "to">;

const PRESET_HOURS: Readonly<Partial<Record<TimePreset, number>>> = {
   "24h": 24,
   "7d": 7 * 24,
   "30d": 30 * 24,
   "90d": 90 * 24,
};

const localIso = (
   day: string | undefined,
   time: string
): string | undefined => {
   if (!day) return undefined;
   const date = new Date(`${day}T${time}`);
   return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const timeRange = (
   preset: TimePreset,
   dates: TimeRange,
   now = Date.now()
): TimeRange => {
   if (preset === "custom")
      return {
         from: localIso(dates.from, "00:00:00.000"),
         to: localIso(dates.to, "23:59:59.999"),
      };
   const hours = PRESET_HOURS[preset];
   return hours ? { from: new Date(now - hours * HOUR_MS).toISOString() } : {};
};

export { timeRange };
export type { TimePreset };
