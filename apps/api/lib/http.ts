import { describeError, logger } from "@/lib/logger";
import type { ErrorCode } from "@s3-viewer/types";
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

export { ApiHttpError, asyncHandler, errorHandler, fail, noContent };
