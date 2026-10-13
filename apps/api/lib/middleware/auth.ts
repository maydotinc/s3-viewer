import { RetryableError, asyncHandler, fail, isAuthApiError } from "@/lib/http";
import { withReadResponse } from "@/lib/s3/read-budget";
import { auth } from "@s3-viewer/auth";
import { ErrorCode, EXPECTED_USER_ID_HEADER } from "@s3-viewer/types";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { accountChanged } from "./expected-user";

type SessionUser = typeof auth.$Infer.Session.user;
type SessionRecord = typeof auth.$Infer.Session.session;

// Better Auth drops database error causes, so an internal session-read failure is treated as retryable.
const isSessionReadFailure = (err: unknown): boolean =>
   isAuthApiError(err) &&
   err.statusCode === 500 &&
   err.body?.code === "FAILED_TO_GET_SESSION";

const readSession = async (req: Request) => {
   try {
      return await auth.api.getSession({
         headers: fromNodeHeaders(req.headers),
         query: { disableCookieCache: true },
      });
   } catch (err) {
      if (!isSessionReadFailure(err)) throw err;
      throw new RetryableError("Session read failed", { cause: err });
   }
};

const authGuard = asyncHandler(async (req, res, next) => {
   const session = await readSession(req);
   if (!session) {
      fail(res, 401, "Sign in required");
      return;
   }
   // sign-in refuses unverified accounts; a session that predates that rule is not honoured either.
   if (!session.user.emailVerified) {
      fail(
         res,
         401,
         "Verify your email to continue",
         ErrorCode.EMAIL_UNVERIFIED
      );
      return;
   }
   const expectedUserId = req.headers[EXPECTED_USER_ID_HEADER.toLowerCase()];
   if (expectedUserId !== undefined && expectedUserId !== session.user.id)
      throw accountChanged();
   req.user = session.user;
   req.session = session.session;
   withReadResponse(session.user.id, res, next);
});

export { authGuard };
export type { SessionRecord, SessionUser };
