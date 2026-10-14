import { PrismaClient } from "@prisma/client";

declare global {
   // eslint-disable-next-line no-var -- only `var` puts a declaration on globalThis
   var prisma: PrismaClient | undefined;
}

const isProduction = process.env.NODE_ENV === "production";

// query logs include bound session tokens and credentials; require explicit opt-in. prisma's own
// error log prints raw messages with bound argument values, and the app already logs the faults
// it surfaces through describeError, so that level sits behind the same opt-in.
const logQueries = process.env.PRISMA_LOG_QUERIES === "true";

const POOL_DEFAULTS: Record<string, string> = {
   connection_limit: "20",
   pool_timeout: "20",
};

const DIRECT_PROTOCOLS: ReadonlySet<string> = new Set([
   "postgres:",
   "postgresql:",
]);

const withPoolDefaults = (raw: string): string => {
   let url: URL;
   try {
      url = new URL(raw);
   } catch {
      return raw;
   }
   if (!DIRECT_PROTOCOLS.has(url.protocol)) return raw;
   for (const [param, value] of Object.entries(POOL_DEFAULTS)) {
      if (!url.searchParams.has(param)) url.searchParams.set(param, value);
   }
   return url.toString();
};

const getPrismaClient = () => {
   const url = process.env.DATABASE_URL;
   return new PrismaClient({
      log: logQueries ? ["query", "warn", "error"] : ["warn"],
      ...(url ? { datasourceUrl: withPoolDefaults(url) } : {}),
   });
};

export const prisma = global.prisma || getPrismaClient();

if (!isProduction) {
   global.prisma = prisma;
}
