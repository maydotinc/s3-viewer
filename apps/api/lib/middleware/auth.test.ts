import { errorHandler } from "@/lib/http";
import { logger } from "@/lib/logger";
import { EXPECTED_USER_ID_HEADER } from "@s3-viewer/types";
import { APIError } from "better-auth/api";
import type { NextFunction, Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeResponse } from "@/lib/testing/fake-response";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@s3-viewer/auth", () => ({ auth: { api: { getSession } } }));

vi.spyOn(logger, "error").mockImplementation(() => {});
vi.spyOn(logger, "warn").mockImplementation(() => {});

const { authGuard } = await import("./auth");

const poolTimeout = (): Error =>
   Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { name: "PrismaClientKnownRequestError", code: "P2024" }
   );

const asBetterAuthFailure = (): APIError =>
   new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to get session",
      code: "FAILED_TO_GET_SESSION",
   });

const session = {
   user: { id: "user1", emailVerified: true },
   session: { id: "session1" },
};

type Outcome = {
   status: number | null;
   body: unknown;
   headers: Record<string, string>;
   passed: boolean;
};

const runGuard = async (
   expectedUserId?: string | string[]
): Promise<{ req: Request } & Outcome> => {
   const req = {
      headers:
         expectedUserId === undefined
            ? {}
            : { [EXPECTED_USER_ID_HEADER.toLowerCase()]: expectedUserId },
      method: "POST",
      path: "/servers",
   } as Request;
   const res = fakeResponse();
   const passed = Promise.withResolvers<void>();
   const next = ((err?: unknown) => {
      if (!err) {
         passed.resolve();
         return;
      }
      errorHandler(err, req, res, vi.fn() as unknown as NextFunction);
   }) as NextFunction;
   authGuard(req, res, next);
   const outcome: Outcome = await Promise.race([
      res.sent.then((body) => ({
         status: res.statusCode,
         body,
         headers: res.headers,
         passed: false,
      })),
      passed.promise.then(() => ({
         status: null,
         body: undefined,
         headers: res.headers,
         passed: true,
      })),
   ]);
   return { req, ...outcome };
};

beforeEach(() => {
   getSession.mockReset();
   vi.mocked(logger.error).mockClear();
   vi.mocked(logger.warn).mockClear();
});

describe("authGuard", () => {
   it("admits a session and hands the user to the route", async () => {
      getSession.mockResolvedValue(session);
      const result = await runGuard();
      expect(result.passed).toBe(true);
      expect(result.req.user).toBe(session.user);
      expect(result.req.session).toBe(session.session);
      expect(getSession).toHaveBeenCalledWith(
         expect.objectContaining({ query: { disableCookieCache: true } })
      );
   });

   it("allows writes bound to the authenticated account", async () => {
      getSession.mockResolvedValue(session);
      expect((await runGuard(session.user.id)).passed).toBe(true);
   });

   it.each(["old-account", "", ["user1", "other-account"]])(
      "refuses a write with mismatched actor %j before reaching its route",
      async (actor) => {
         getSession.mockResolvedValue(session);
         const result = await runGuard(actor);
         expect(result.passed).toBe(false);
         expect(result.status).toBe(403);
         expect(result.body).toMatchObject({ code: "ACCOUNT_CHANGED" });
         expect(result.req.user).toBeUndefined();
      }
   );

   it("answers 401 for a session whose email was never verified", async () => {
      getSession.mockResolvedValue({
         ...session,
         user: { ...session.user, emailVerified: false },
      });
      const result = await runGuard();
      expect(result.status).toBe(401);
      expect(result.body).toMatchObject({ code: "EMAIL_UNVERIFIED" });
      expect(result.passed).toBe(false);
   });

   it("answers 401 when there is no session", async () => {
      getSession.mockResolvedValue(null);
      const result = await runGuard();
      expect(result.status).toBe(401);
      expect(result.body).toEqual({ message: "Sign in required" });
      expect(result.headers).toEqual({});
      expect(result.passed).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
   });

   it("answers 503 with Retry-After when a pool timeout hits the session read", async () => {
      getSession.mockImplementation(async () => {
         try {
            throw poolTimeout();
         } catch {
            throw asBetterAuthFailure();
         }
      });
      const result = await runGuard();
      expect(asBetterAuthFailure().cause).toBeUndefined();
      expect(result.status).toBe(503);
      expect(result.headers).toEqual({ "Retry-After": "2" });
      expect(result.body).toEqual({
         message: "The server is busy. Try again shortly.",
      });
      expect(logger.warn).toHaveBeenCalledWith(
         "Session read failed",
         expect.objectContaining({ path: "/servers" })
      );
      expect(logger.error).not.toHaveBeenCalled();
   });

   it("leaves a 401 from better auth alone", async () => {
      getSession.mockRejectedValue(
         new APIError("UNAUTHORIZED", {
            message: "Failed to get session",
            code: "FAILED_TO_GET_SESSION",
         })
      );
      const result = await runGuard();
      expect(result.status).toBe(401);
      expect(result.headers).toEqual({});
   });

   it("leaves an unrelated failure to the generic 500", async () => {
      getSession.mockRejectedValue(new Error("connect ECONNREFUSED"));
      const result = await runGuard();
      expect(result.status).toBe(500);
      expect(result.headers).toEqual({});
      expect(logger.error).toHaveBeenCalledWith(
         "Unhandled request error",
         expect.anything()
      );
   });
});
