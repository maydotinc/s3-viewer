const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

const RANK: Record<LogLevel, number> = {
   debug: 10,
   info: 20,
   warn: 30,
   error: 40,
};

let configured: LogLevel | undefined;

// env.ts imports the logger, so it hands the validated LOG_LEVEL over once parsed instead of the logger reading it.
const setLogLevel = (level: LogLevel | undefined): void => {
   configured = level;
};

// lines written while env.ts is still parsing fall back on NODE_ENV, which .env has loaded by then.
const logs = (level: LogLevel): boolean =>
   RANK[level] >=
   RANK[
      configured ?? (process.env.NODE_ENV === "production" ? "warn" : "debug")
   ];

export { LOG_LEVELS, logs, setLogLevel };
export type { LogLevel };
