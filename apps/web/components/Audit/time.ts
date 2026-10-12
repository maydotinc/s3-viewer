import type { TimePreset } from "@/lib/utils/audit-time";

const TIME_PRESET_LABELS: Readonly<Record<TimePreset, string>> = {
   "": "Any time",
   "24h": "Last 24 hours",
   "7d": "Last 7 days",
   "30d": "Last 30 days",
   "90d": "Last 90 days",
   custom: "Custom range",
};

export { TIME_PRESET_LABELS };
export type { TimePreset };
