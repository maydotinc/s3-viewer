import { logs, type LogLevel } from "./log-level";

const write = (
   level: LogLevel,
   message: string,
   meta?: Record<string, unknown>
) => {
   if (!logs(level)) return;
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
