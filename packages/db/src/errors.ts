import { Prisma } from "@prisma/client";

const isPrismaError = (error: unknown, code: string): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

const isUniqueViolation = (error: unknown): boolean =>
   isPrismaError(error, "P2002");

const isMissingRow = (error: unknown): boolean => isPrismaError(error, "P2025");

const isMissingTable = (error: unknown): boolean =>
   isPrismaError(error, "P2021");

// raw queries surface the Postgres SQLSTATE under meta.code; class 22 is "data exception".
const rawSqlState = (error: unknown): string | null =>
   error instanceof Prisma.PrismaClientKnownRequestError &&
   error.code === "P2010"
      ? String(error.meta?.code)
      : null;

const DATA_ERROR_CODES = new Set([
   "P2000",
   "P2005",
   "P2006",
   "P2007",
   "P2011",
   "P2023",
]);

const isDataError = (error: unknown): boolean =>
   (error instanceof Prisma.PrismaClientKnownRequestError &&
      DATA_ERROR_CODES.has(error.code)) ||
   (rawSqlState(error)?.startsWith("22") ?? false);

const QUERY_CANCELED = "57014";

const isStatementTimeout = (error: unknown): boolean =>
   rawSqlState(error) === QUERY_CANCELED;

// a timed-out transaction is known to have rolled back; a write conflict is only retried by request handlers.
const DATABASE_TIMEOUT_REASONS: Readonly<Record<string, string>> = {
   P2024: "Database pool timeout",
   P2028: "Database transaction timeout",
};

const DATABASE_RETRY_REASONS: Readonly<Record<string, string>> = {
   ...DATABASE_TIMEOUT_REASONS,
   P2034: "Database write conflict",
};

const isDatabaseTimeout = (error: unknown): boolean =>
   error instanceof Prisma.PrismaClientKnownRequestError &&
   Object.hasOwn(DATABASE_TIMEOUT_REASONS, error.code);

const databaseRetryReason = (err: unknown): string | null => {
   let current = err;
   for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
      const code = (current as { code?: unknown }).code;
      if (
         typeof code === "string" &&
         Object.hasOwn(DATABASE_RETRY_REASONS, code)
      )
         return DATABASE_RETRY_REASONS[code] ?? null;
      current = (current as { cause?: unknown }).cause;
   }
   return null;
};

export {
   databaseRetryReason,
   isDataError,
   isDatabaseTimeout,
   isMissingRow,
   isMissingTable,
   isStatementTimeout,
   isUniqueViolation,
};
