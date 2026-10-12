type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
   debug: 10,
   info: 20,
   warn: 30,
   error: 40,
};

const isLevel = (value: string): value is Level => Object.hasOwn(LEVELS, value);

// resolved on first write, after env.ts has loaded .env, not at import time.
let threshold: number | undefined;

const resolveThreshold = (): number => {
   const configured = process.env.LOG_LEVEL?.trim() ?? "";
   const fallback: Level =
      process.env.NODE_ENV === "production" ? "warn" : "debug";
   return LEVELS[isLevel(configured) ? configured : fallback];
};

const write = (
   level: Level,
   message: string,
   meta?: Record<string, unknown>
) => {
   threshold ??= resolveThreshold();
   if (LEVELS[level] < threshold) return;
   const line = { t: new Date().toISOString(), level, message, ...meta };
   (level === "error" || level === "warn" ? console.error : console.log)(
      JSON.stringify(line)
   );
};

const banner = (lines: string[]) =>
   process.stdout.write(`${lines.join("\n")}\n`);

const logger = {
   debug: (m: string, meta?: Record<string, unknown>) =>
      write("debug", m, meta),
   info: (m: string, meta?: Record<string, unknown>) => write("info", m, meta),
   warn: (m: string, meta?: Record<string, unknown>) => write("warn", m, meta),
   error: (m: string, meta?: Record<string, unknown>) =>
      write("error", m, meta),
};

export { banner, logger };
