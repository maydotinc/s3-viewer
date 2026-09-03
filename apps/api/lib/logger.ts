type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
   debug: 10,
   info: 20,
   warn: 30,
   error: 40,
};
const threshold =
   LEVELS[
      (process.env.LOG_LEVEL as Level | undefined) ??
         (process.env.NODE_ENV === "production" ? "warn" : "debug")
   ] ?? LEVELS.info;

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
