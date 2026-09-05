import { describeError, logger } from "@/lib/logger";
import { GENERIC_ERROR_MESSAGE, type ErrorCode } from "@s3-viewer/types";
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

// a fan-out must not outlive the caller, so every call it makes rides one
// signal. a request whose body is already parsed closes the moment it is read,
// so the disconnect comes from the response instead
const requestSignal = (res: Response, timeoutMs: number): AbortSignal => {
   const disconnected = new AbortController();
   res.on("close", () => {
      if (!res.writableEnded) disconnected.abort();
   });
   return AbortSignal.any([
      disconnected.signal,
      AbortSignal.timeout(timeoutMs),
   ]);
};

// better-call's ValidationError shares APIError's name and shape but not its
// prototype, so the shape is what identifies both
const isAuthApiError = (err: unknown): err is APIError =>
   err instanceof Error &&
   err.name === "APIError" &&
   typeof (err as { statusCode?: unknown }).statusCode === "number";

const BODY_PARSER_ERRORS: Readonly<Record<string, [number, string]>> = {
   "entity.too.large": [413, "Request body is too large"],
   "entity.parse.failed": [400, "Request body is not valid JSON"],
   "encoding.unsupported": [415, "Unsupported request encoding"],
};

const bodyParserError = (err: unknown): [number, string] | undefined => {
   if (typeof err !== "object" || err === null || !("type" in err)) return;
   const type = (err as { type: unknown }).type;
   return typeof type === "string" ? BODY_PARSER_ERRORS[type] : undefined;
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
   if (isAuthApiError(err)) {
      const upstream = err.statusCode >= 500;
      if (upstream) {
         logger.error("Better Auth request error", {
            method: req.method,
            path: req.path,
            requestId: res.locals.requestId as string | undefined,
            error: describeError(err),
         });
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
   const parsed = bodyParserError(err);
   if (parsed) {
      fail(res, parsed[0], parsed[1]);
      return;
   }
   logger.error("Unhandled request error", {
      method: req.method,
      path: req.path,
      requestId: res.locals.requestId as string | undefined,
      error: describeError(err),
   });
   fail(res, 500, "Something went wrong");
};

export {
   ApiHttpError,
   asyncHandler,
   errorHandler,
   fail,
   noContent,
   requestSignal,
};
