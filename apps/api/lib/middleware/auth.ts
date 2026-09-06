import { asyncHandler, fail } from "@/lib/http";
import { auth } from "@s3-viewer/auth";
import { fromNodeHeaders } from "better-auth/node";

type SessionUser = typeof auth.$Infer.Session.user;
type SessionRecord = typeof auth.$Infer.Session.session;

declare global {
   // eslint-disable-next-line @typescript-eslint/no-namespace
   namespace Express {
      interface Request {
         user?: SessionUser;
         session?: SessionRecord;
      }
   }
}

const authGuard = asyncHandler(async (req, res, next) => {
   // the signed cookie cache would keep serving a revoked session until it
   // expires (60 s), so every api request pays one read of the session row
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
   });
   // Shared auth policy also revokes sessions at their absolute age limit.
   if (!session) {
      fail(res, 401, "Sign in required");
      return;
   }
   req.user = session.user;
   req.session = session.session;
   next();
});

export { authGuard };
export type { SessionRecord, SessionUser };
