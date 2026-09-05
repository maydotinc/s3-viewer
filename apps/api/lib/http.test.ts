import { logger } from "@/lib/logger";
import { ErrorCode, GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { APIError } from "better-auth/api";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ApiHttpError, errorHandler } from "./http";

vi.spyOn(logger, "error").mockImplementation(() => {});

const handle = (err: unknown) => {
   const json = vi.fn();
   const status = vi.fn(() => ({ json }));
   const res = { headersSent: false, locals: {}, status };
   errorHandler(
      err,
      { method: "POST", path: "/account/password" } as Request,
      res as unknown as Response,
      vi.fn() as unknown as NextFunction
   );
   return { status, json };
};

describe("errorHandler", () => {
   it("passes an ApiHttpError through with its code", () => {
      const { status, json } = handle(
         new ApiHttpError(403, "Nope", ErrorCode.SESSION_STALE)
      );
      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
         message: "Nope",
         code: ErrorCode.SESSION_STALE,
      });
   });

   it("answers a better auth APIError with its own status and message", () => {
      const { status, json } = handle(
         new APIError("BAD_REQUEST", {
            message: "Password is too short",
            code: "PASSWORD_TOO_SHORT",
         })
      );
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ message: "Password is too short" });
   });

   it("falls back to the generic message when better auth carries none", () => {
      const { status, json } = handle(new APIError("UNAUTHORIZED"));
      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ message: GENERIC_ERROR_MESSAGE });
   });

   it("maps a body parser failure to its status", () => {
      const { status, json } = handle({ type: "entity.too.large" });
      expect(status).toHaveBeenCalledWith(413);
      expect(json).toHaveBeenCalledWith({
         message: "Request body is too large",
      });
   });

   it("hides anything else behind a 500", () => {
      const { status, json } = handle(new Error("connect ECONNREFUSED"));
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ message: "Something went wrong" });
   });
});

describe("errorHandler with better-call shapes", () => {
   it("recognises a validation error by shape, not prototype", () => {
      const err = Object.assign(new Error("email: Invalid email"), {
         name: "APIError",
         statusCode: 400,
         body: { message: "email: Invalid email", code: "VALIDATION_ERROR" },
      });
      const { status, json } = handle(err);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ message: "email: Invalid email" });
   });

   it("hides and logs an upstream 5xx from better auth", () => {
      const { status, json } = handle(
         new APIError("INTERNAL_SERVER_ERROR", { message: "db exploded" })
      );
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ message: GENERIC_ERROR_MESSAGE });
      expect(logger.error).toHaveBeenCalledWith(
         "Better Auth request error",
         expect.objectContaining({ error: "APIError: db exploded" })
      );
   });
});
