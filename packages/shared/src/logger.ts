type LogMeta = Record<string, unknown>;

type Logger = {
   info: (message: string, meta?: LogMeta) => void;
   warn: (message: string, meta?: LogMeta) => void;
   error: (message: string, meta?: LogMeta) => void;
};

const withMeta = (meta: LogMeta | undefined): LogMeta[] => (meta ? [meta] : []);

// what a package logs through until its host hands it a structured, leveled logger.
const consoleLogger: Logger = {
   info: (message, meta) => console.info(message, ...withMeta(meta)),
   warn: (message, meta) => console.warn(message, ...withMeta(meta)),
   error: (message, meta) => console.error(message, ...withMeta(meta)),
};

export { consoleLogger };
export type { Logger };
