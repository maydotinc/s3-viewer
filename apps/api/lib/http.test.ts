import { logger } from "./logger";
import { ErrorCode, GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { APIError } from "better-auth/api";
import express, {
   Router,
   type NextFunction,
   type Request,
   type Response,
} from "express";
import { deflateRawSync } from "node:zlib";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { fakeResponse } from "@/lib/testing/fake-response";
import {
   ApiHttpError,
   RetryableError,
   disconnectSignal,
   errorHandler,
   rethrowDbError,
} from "./http";

vi.spyOn(logger, "error").mockImplementation(() => {});
vi.spyOn(logger, "warn").mockImplementation(() => {});

beforeEach(() => {
   vi.mocked(logger.error).mockClear();
   vi.mocked(logger.warn).mockClear();
});

describe("disconnectSignal", () => {
   it.each([false, true])(
      "honors an earlier response close with writableEnded=%s",
      (writableEnded) => {
         const res = fakeResponse({ destroyed: true, writableEnded });
         res.emit("close");
         const signal = disconnectSignal(res);
         expect(signal.aborted).toBe(!writableEnded);
         expect(res.listenerCount("close")).toBe(0);
      }
   );

   it("aborts on a later disconnect and releases its listener", () => {
      const res = fakeResponse();
      const signal = disconnectSignal(res);
      expect(signal.aborted).toBe(false);
      res.emit("close");
      expect(signal.aborted).toBe(true);
      expect(res.listenerCount("close")).toBe(0);
   });
});

const handle = (err: unknown, request: Partial<Request> = {}) => {
   const json = vi.fn();
   const status = vi.fn(() => ({ json }));
   const headers: Record<string, string> = {};
   const setHeader = vi.fn((name: string, value: string) => {
      headers[name] = value;
   });
   const res = { headersSent: false, locals: {}, status, setHeader };
   errorHandler(
      err,
      {
         method: "POST",
         path: "/account/password",
         ...request,
      } as Request,
      res as unknown as Response,
      vi.fn() as unknown as NextFunction
   );
   return { status, json, headers };
};

const poolTimeout = (): Error =>
   Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { name: "PrismaClientKnownRequestError", code: "P2024" }
   );

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

   it.each([
      ["application/json; charset=latin1", "json", 415],
      ["application/json; charset=nope", "text", 415],
   ])(
      "rejects a %s body from the %s parser without logging a fault",
      async (contentType, parser, expected) => {
         const parse =
            parser === "json"
               ? express.json()
               : express.text({ type: () => true, inflate: false });
         const req = Object.assign(Readable.from([Buffer.from("{}")]), {
            headers: {
               "content-type": contentType,
               "content-length": "2",
            },
            method: "POST",
            path: "/servers",
         });
         const failure = await new Promise<unknown>((resolve) => {
            parse(req as unknown as Request, {} as Response, resolve);
         });

         const { status } = handle(failure);

         expect(status).toHaveBeenCalledWith(expected);
         expect(logger.error).not.toHaveBeenCalled();
      }
   );

   it.each(["request.aborted", "request.size.invalid"])(
      "answers a %s body failure with a 400",
      (type) => {
         const { status } = handle({ type });
         expect(status).toHaveBeenCalledWith(400);
         expect(logger.error).not.toHaveBeenCalled();
      }
   );

   it("does not treat an inherited property name as a body parser failure", () => {
      const { status } = handle({ type: "constructor" });
      expect(status).toHaveBeenCalledWith(500);
   });

   it("hides anything else behind a 500", () => {
      const { status, json } = handle(new Error("connect ECONNREFUSED"));
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ message: "Something went wrong" });
   });

   it("logs an unhandled fault with its stack and cause, and keeps both out of the response", () => {
      const fault = new TypeError("Cannot read properties of undefined", {
         cause: new Error("row vanished"),
      });
      const { json } = handle(fault);
      expect(logger.error).toHaveBeenCalledWith("Unhandled request error", {
         method: "POST",
         path: "/account/password",
         requestId: null,
         error: "TypeError: Cannot read properties of undefined",
         stack: fault.stack,
         cause: "Error: row vanished",
      });
      expect(fault.stack).toContain("http.test.ts");
      expect(json).toHaveBeenCalledWith({ message: "Something went wrong" });
   });

   it("logs a prisma fault by class, code and target, never its bound values", () => {
      const secret = "ada@example.com";
      const fault = new Prisma.PrismaClientKnownRequestError(
         `Invalid \`prisma.user.create()\` invocation:\n  data: { email: "${secret}" }\nUnique constraint failed`,
         { code: "P2002", clientVersion: "6", meta: { target: ["email"] } }
      );
      const wrapper = new Error("create failed", {
         cause: new Prisma.PrismaClientUnknownRequestError(
            `Key (email)=(${secret}) already exists`,
            { clientVersion: "6" }
         ),
      });
      handle(fault);
      handle(wrapper);
      const [first, second] = vi
         .mocked(logger.error)
         .mock.calls.map(([, context]) => context);
      expect(first).toMatchObject({
         error: "PrismaClientKnownRequestError P2002 (target: email)",
      });
      expect(first?.stack).toMatch(
         /^PrismaClientKnownRequestError P2002 \(target: email\)\n\s+at /
      );
      expect(first?.stack).toContain("http.test.ts");
      expect(second).toMatchObject({
         cause: "PrismaClientUnknownRequestError",
      });
      expect(JSON.stringify([first, second])).not.toContain(secret);
   });

   it("logs a thrown non-error without inventing a stack", () => {
      handle("plain string");
      expect(logger.error).toHaveBeenCalledWith("Unhandled request error", {
         method: "POST",
         path: "/account/password",
         requestId: null,
         error: "plain string",
      });
   });
});

describe("archive token log redaction", () => {
   const objectName = "confidential-board-minutes.txt";
   const payload = deflateRawSync(
      JSON.stringify([
         "nonce",
         "user12345",
         "server12345",
         "bucket",
         Date.now() + 60_000,
         [objectName],
      ])
   ).toString("base64url");
   const token = `t1.${payload}.signature`;
   const fullPath = `/servers/server12345/buckets/bucket/objects/v3/archive/${token}`;

   const failures = [
      ["retryable", () => poolTimeout(), "warn"],
      [
         "auth upstream",
         () => new APIError("INTERNAL_SERVER_ERROR", { message: "db failed" }),
         "error",
      ],
      ["unhandled", () => new Error("upstream failed"), "error"],
   ] as const;

   for (const [name, failure, level] of failures) {
      it.each([
         ["before route matching", fullPath],
         ["inside a mounted router", `/v3/archive/${token}`],
         ["with case-insensitive routing", `/V3/ARCHIVE/${token}/`],
      ])(`redacts a ${name} failure %s`, (_context, path) => {
         handle(failure(), {
            method: "GET",
            path,
            originalUrl: fullPath,
            params: {},
         });

         expect(logger[level]).toHaveBeenCalledOnce();
         expect(logger[level]).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ path: path.replace(token, "[redacted]") })
         );
         const logged = JSON.stringify(vi.mocked(logger[level]).mock.calls);
         expect(logged).not.toContain(token);
         expect(logged).not.toContain(payload);
         expect(logged).not.toContain(objectName);
      });
   }

   it.each([
      "/account/password",
      "/servers/server12345/buckets/bucket/objects/v3/archive",
      "/servers/server12345/buckets/bucket/objects/v3/archive/",
   ])("keeps non-token paths unchanged: %s", (path) => {
      handle(new Error("upstream failed"), { path });
      expect(logger.error).toHaveBeenCalledWith(
         "Unhandled request error",
         expect.objectContaining({ path })
      );
   });

   it("answers an Express route-decoding failure with a 400 that logs nothing", async () => {
      const router = Router();
      router.get(
         "/servers/:serverId/buckets/:bucketName/objects/v3/archive/:token",
         (_req, res) => {
            res.end();
         }
      );
      const path = `${fullPath}%ZZ`;
      const failure = await new Promise<unknown>((resolve) => {
         router(
            { method: "GET", url: path } as Request,
            {} as Response,
            resolve
         );
      });
      expect(failure).toBeInstanceOf(URIError);
      expect((failure as Error).message).toContain(token);

      const { status, json } = handle(failure, { path, params: {} });

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
         message: "Request path is not validly encoded",
      });
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
   });

   it.each(failures)(
      "redacts tokens echoed by a %s error",
      (name, _failure, level) => {
         const message = `Failed for ${token}`;
         const failure =
            level === "warn"
               ? new RetryableError(message)
               : name === "auth upstream"
                 ? new APIError("INTERNAL_SERVER_ERROR", { message })
                 : new Error(message);
         handle(failure, { path: fullPath });

         const logged = JSON.stringify(vi.mocked(logger[level]).mock.calls);
         expect(logged).toContain("Failed for [redacted]");
         expect(logged).not.toContain(token);
         expect(logged).not.toContain(payload);
      }
   );

   it("redacts the decoded form of a percent-encoded token in error messages", () => {
      const encodedToken = token.replaceAll(".", "%2E");
      handle(
         new Error(`Failed for ${token}`, {
            cause: new Error(`Cause names ${token}`),
         }),
         { path: fullPath.replace(token, encodedToken) }
      );
      const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
      expect(logged).toContain("Failed for [redacted]");
      expect(logged).toContain("Cause names [redacted]");
      expect(vi.mocked(logger.error).mock.calls[0]?.[1]?.stack).toContain(
         "Failed for [redacted]"
      );
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(encodedToken);
      expect(logged).not.toContain(payload);
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

   it("still reports a coded 500 from another better auth endpoint as a fault", () => {
      const { status, json, headers } = handle(
         new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create session",
            code: "FAILED_TO_CREATE_SESSION",
         })
      );
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ message: GENERIC_ERROR_MESSAGE });
      expect(headers).toEqual({});
   });
});

describe("errorHandler on a retryable failure", () => {
   it("answers a pool timeout with 503 and Retry-After", () => {
      const { status, json, headers } = handle(poolTimeout());
      expect(status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith({
         message: "The server is busy. Try again shortly.",
      });
      expect(headers).toEqual({ "Retry-After": "2" });
      expect(logger.warn).toHaveBeenCalledWith(
         "Database pool timeout",
         expect.objectContaining({ path: "/account/password" })
      );
      expect(logger.error).not.toHaveBeenCalled();
   });

   it.each([
      ["P2028", "Database transaction timeout"],
      ["P2034", "Database write conflict"],
   ])("answers a rolled-back transaction (%s) with 503", (code, reason) => {
      const { status, json, headers } = handle(
         Object.assign(new Error("Transaction API error"), {
            name: "PrismaClientKnownRequestError",
            code,
         })
      );
      expect(status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith({
         message: "The server is busy. Try again shortly.",
      });
      expect(headers).toEqual({ "Retry-After": "2" });
      expect(logger.warn).toHaveBeenCalledWith(
         reason,
         expect.objectContaining({ path: "/account/password" })
      );
      expect(logger.error).not.toHaveBeenCalled();
   });

   it("keeps other database errors as faults", () => {
      const { status, headers } = handle(
         Object.assign(new Error("Unique constraint failed"), {
            name: "PrismaClientKnownRequestError",
            code: "P2002",
         })
      );
      expect(status).toHaveBeenCalledWith(500);
      expect(headers).toEqual({});
      expect(logger.warn).not.toHaveBeenCalled();
   });

   it("recognises a pool timeout carried as the cause of another error", () => {
      const { status, headers } = handle(
         new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to get session",
            cause: poolTimeout(),
         })
      );
      expect(status).toHaveBeenCalledWith(503);
      expect(headers).toEqual({ "Retry-After": "2" });
      expect(logger.warn).toHaveBeenCalledWith(
         "Database pool timeout",
         expect.anything()
      );
   });

   it("logs the reason a caller gave and never treats a cycle as a hang", () => {
      const cyclic = new Error("looping");
      Object.assign(cyclic, { cause: cyclic });
      const { status, headers } = handle(
         new RetryableError("Session read failed", { cause: cyclic })
      );
      expect(status).toHaveBeenCalledWith(503);
      expect(headers).toEqual({ "Retry-After": "2" });
      expect(logger.warn).toHaveBeenCalledWith(
         "Session read failed",
         expect.anything()
      );
   });
});

describe("rethrowDbError", () => {
   const prismaError = (code: string) =>
      new Prisma.PrismaClientKnownRequestError("failed", {
         code,
         clientVersion: "test",
      });
   const unique = new ApiHttpError(409, "Taken");
   const missing = new ApiHttpError(404, "Gone");

   it("maps unique violations and missing rows to the errors it is given", () => {
      expect(() =>
         rethrowDbError(prismaError("P2002"), { unique, missing })
      ).toThrow(unique);
      expect(() =>
         rethrowDbError(prismaError("P2025"), { unique, missing })
      ).toThrow(missing);
   });

   it("rethrows anything it has no mapping for unchanged", () => {
      const original = prismaError("P2025");
      expect(() => rethrowDbError(original, { unique })).toThrow(original);
      const other = new Error("boom");
      expect(() => rethrowDbError(other, { unique, missing })).toThrow(other);
   });
});
