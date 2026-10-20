import { MEMBER_NOT_FOUND, SERVER_NOT_FOUND } from "./constants";
import { logger } from "./logger";
import { isMissingRow } from "@s3-viewer/db/errors";
import {
   GENERIC_ERROR_MESSAGE,
   OBJECT_MUTATION_PATH,
   ErrorCode,
   describeError,
   isPrismaClientError,
} from "@s3-viewer/types";
import type { APIError } from "better-auth/api";
import type {
   ErrorRequestHandler,
   NextFunction,
   Request,
   RequestHandler,
   Response,
} from "express";

class ApiHttpError extends Error {
   constructor(
      public readonly status: number,
      message: string,
      public readonly code?: ErrorCode
   ) {
      super(message);
      this.name = "ApiHttpError";
   }
}

const rateLimited = (message: string): ApiHttpError =>
   new ApiHttpError(429, message, ErrorCode.RATE_LIMITED);

const serverNotFound = (): ApiHttpError =>
   new ApiHttpError(404, SERVER_NOT_FOUND);

const memberNotFound = (): ApiHttpError =>
   new ApiHttpError(404, MEMBER_NOT_FOUND);

const isRateLimited = (err: unknown): err is ApiHttpError =>
   err instanceof ApiHttpError && err.status === 429;

type DbErrorMap = { missing: ApiHttpError };

const rethrowDbError = (err: unknown, { missing }: DbErrorMap): never => {
   if (isMissingRow(err)) throw missing;
   throw err;
};

const noContent = (res: Response): void => {
   res.status(204).end();
};

const fail = (
   res: Response,
   status: number,
   message: string,
   code?: ErrorCode
): void => {
   res.status(status).json(code ? { message, code } : { message });
};

const requestId = (res: Response): string | null =>
   res.locals.requestId ?? null;

type AsyncRequestHandler = (
   req: Request,
   res: Response,
   next: NextFunction
) => Promise<unknown>;

const asyncHandler =
   (fn: AsyncRequestHandler): RequestHandler =>
   (req, res, next) => {
      fn(req, res, next).catch(next);
   };

// parsed requests close before the operation finishes; detect disconnects on the response.
const watchDisconnect = (
   res: Response,
   controller: AbortController,
   req?: Request
): (() => void) => {
   const dispose = () => {
      res.off("close", onResponseClose);
      req?.off("close", onRequestClose);
   };
   const onResponseClose = () => {
      if (!res.writableEnded) controller.abort();
      dispose();
   };
   const onRequestClose = () => {
      if (!req?.complete) {
         controller.abort();
         dispose();
      }
   };
   res.once("close", onResponseClose);
   req?.once("close", onRequestClose);
   if (res.destroyed) onResponseClose();
   else if (req?.destroyed || req?.aborted) onRequestClose();
   return dispose;
};

const disconnectSignal = (res: Response): AbortSignal => {
   const controller = new AbortController();
   watchDisconnect(res, controller);
   return controller.signal;
};

const requestSignal = (res: Response, timeoutMs: number): AbortSignal =>
   AbortSignal.any([disconnectSignal(res), AbortSignal.timeout(timeoutMs)]);

// Better Call ValidationError has APIError's shape but not its prototype.
const isAuthApiError = (err: unknown): err is APIError =>
   err instanceof Error &&
   err.name === "APIError" &&
   typeof (err as { statusCode?: unknown }).statusCode === "number";

class RetryableError extends Error {
   constructor(
      public readonly reason: string,
      options?: ErrorOptions
   ) {
      super(reason, options);
      this.name = "RetryableError";
   }
}

const DATABASE_RETRY_REASONS: Readonly<Record<string, string>> = {
   P2024: "Database pool timeout",
   P2028: "Database transaction timeout",
   P2034: "Database write conflict",
};

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

const retryReason = (err: unknown): string | null =>
   databaseRetryReason(err) ??
   (err instanceof RetryableError ? err.reason : null);

const BODY_PARSER_ERRORS: Readonly<Record<string, [number, string]>> = {
   "entity.too.large": [413, "Request body is too large"],
   "entity.parse.failed": [400, "Request body is not valid JSON"],
   "encoding.unsupported": [415, "Unsupported request encoding"],
   "charset.unsupported": [415, "Unsupported request charset"],
   "request.aborted": [400, "Request body was not fully received"],
   "request.size.invalid": [400, "Request body does not match its length"],
};

const MALFORMED_PATH: [number, string] = [
   400,
   "Request path is not validly encoded",
];

const clientError = (err: unknown): [number, string] | undefined => {
   if (err instanceof URIError && (err as { status?: unknown }).status === 400)
      return MALFORMED_PATH;
   if (typeof err !== "object" || err === null || !("type" in err)) return;
   const type = (err as { type: unknown }).type;
   return typeof type === "string" && Object.hasOwn(BODY_PARSER_ERRORS, type)
      ? BODY_PARSER_ERRORS[type]
      : undefined;
};

const ARCHIVE_TOKEN_PATH = new RegExp(
   `(${OBJECT_MUTATION_PATH}/archive/)([^/]+)`,
   "i"
);

const logPath = (req: Request): string =>
   req.path.replace(ARCHIVE_TOKEN_PATH, "$1[redacted]");

const redactArchiveToken = (req: Request, message: string): string => {
   const token = ARCHIVE_TOKEN_PATH.exec(req.path)?.[2];
   if (!token) return message;
   const redacted = message.replaceAll(token, "[redacted]");
   try {
      return redacted.replaceAll(decodeURIComponent(token), "[redacted]");
   } catch {
      return redacted;
   }
};

const failureContext = (req: Request, res: Response, err: unknown) => ({
   method: req.method,
   path: logPath(req),
   requestId: requestId(res),
   error: redactArchiveToken(req, describeError(err)),
});

// a prisma stack opens with its message, so only the frames after it are kept.
const stackOf = (err: Error): string | undefined => {
   if (!err.stack || !isPrismaClientError(err)) return err.stack;
   const end = err.stack.indexOf(err.message);
   return end === -1
      ? undefined
      : `${describeError(err)}${err.stack.slice(end + err.message.length)}`;
};

const faultTrace = (
   req: Request,
   err: unknown
): { stack?: string; cause?: string } => {
   if (!(err instanceof Error)) return {};
   const stack = stackOf(err);
   return {
      ...(stack ? { stack: redactArchiveToken(req, stack) } : {}),
      ...(err.cause === undefined
         ? {}
         : { cause: redactArchiveToken(req, describeError(err.cause)) }),
   };
};

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
   if (res.headersSent) {
      next(err);
      return;
   }
   if (err instanceof ApiHttpError) {
      fail(res, err.status, err.message, err.code);
      return;
   }
   const retry = retryReason(err);
   if (retry) {
      logger.warn(
         redactArchiveToken(req, retry),
         failureContext(req, res, err)
      );
      res.setHeader("Retry-After", "2");
      fail(res, 503, "The server is busy. Try again shortly.");
      return;
   }
   if (isAuthApiError(err)) {
      const upstream = err.statusCode >= 500;
      if (upstream) {
         logger.error(
            "Better Auth request error",
            failureContext(req, res, err)
         );
      }
      fail(
         res,
         err.statusCode,
         upstream
            ? GENERIC_ERROR_MESSAGE
            : (err.body?.message ?? GENERIC_ERROR_MESSAGE)
      );
      return;
   }
   const rejected = clientError(err);
   if (rejected) {
      fail(res, rejected[0], rejected[1]);
      return;
   }
   logger.error("Unhandled request error", {
      ...failureContext(req, res, err),
      ...faultTrace(req, err),
   });
   fail(res, 500, "Something went wrong");
};

const sendPartialResult = <T extends { failed: readonly unknown[] }>(
   res: Response,
   result: T
): void => {
   res.status(result.failed.length > 0 ? 207 : 200).json(result);
};

export {
   ApiHttpError,
   RetryableError,
   asyncHandler,
   disconnectSignal,
   errorHandler,
   fail,
   isAuthApiError,
   isRateLimited,
   memberNotFound,
   noContent,
   rateLimited,
   requestId,
   requestSignal,
   rethrowDbError,
   retryReason,
   sendPartialResult,
   serverNotFound,
   watchDisconnect,
};
