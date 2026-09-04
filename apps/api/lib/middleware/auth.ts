import { asyncHandler, fail } from "@/lib/http";
import { auth } from "@s3-viewer/auth";
import { DAY_MS, SESSION_ABSOLUTE_TTL_DAYS } from "@s3-viewer/types";
import { fromNodeHeaders } from "better-auth/node";

type SessionUser = typeof auth.$Infer.Session.user;

declare global {
   // eslint-disable-next-line @typescript-eslint/no-namespace
   namespace Express {
      interface Request {
         user?: SessionUser;
      }
   }
}

const ABSOLUTE_TTL_MS = SESSION_ABSOLUTE_TTL_DAYS * DAY_MS;

// the sliding window alone lets a session live forever if it is used often
// enough, so a stolen cookie is capped at its original creation date
const beyondAbsoluteTtl = (createdAt: Date): boolean =>
   Date.now() - createdAt.getTime() > ABSOLUTE_TTL_MS;

const authGuard = asyncHandler(async (req, res, next) => {
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
   });
   if (!session || beyondAbsoluteTtl(new Date(session.session.createdAt))) {
      fail(res, 401, "Sign in required");
      return;
   }
   req.user = session.user;
   next();
});

export { authGuard };
export type { SessionUser };
