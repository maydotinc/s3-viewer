type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
   debug: 10,
   info: 20,
   warn: 30,
   error: 40,
};

// env.ts rejects an unknown level at startup; logger keeps out of that import so
// it stays usable without a full environment, and an unrecognised level falls
// back to the documented default here instead of to something more verbose
const isLevel = (value: string): value is Level => Object.hasOwn(LEVELS, value);

const configured = process.env.LOG_LEVEL?.trim() ?? "";
const fallback: Level =
   process.env.NODE_ENV === "production" ? "warn" : "debug";
const threshold = LEVELS[isLevel(configured) ? configured : fallback];

const write = (
   level: Level,
   message: string,
   meta?: Record<string, unknown>
) => {
   if (LEVELS[level] < threshold) return;
   const line = { t: new Date().toISOString(), level, message, ...meta };
   (level === "error" || level === "warn" ? console.error : console.log)(
      JSON.stringify(line)
   );
};

const describeError = (err: unknown): string =>
   err instanceof Error ? `${err.name}: ${err.message}` : String(err);

const logger = {
   debug: (m: string, meta?: Record<string, unknown>) =>
      write("debug", m, meta),
   info: (m: string, meta?: Record<string, unknown>) => write("info", m, meta),
   warn: (m: string, meta?: Record<string, unknown>) => write("warn", m, meta),
   error: (m: string, meta?: Record<string, unknown>) =>
      write("error", m, meta),
};

export { describeError, logger };
