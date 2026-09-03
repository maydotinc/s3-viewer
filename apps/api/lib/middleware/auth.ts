import { asyncHandler, fail } from "@/lib/http";
import { auth } from "@s3-viewer/auth";
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

const authGuard = asyncHandler(async (req, res, next) => {
   const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
   });
   if (!session) {
      fail(res, 401, "Sign in required");
      return;
   }
   req.user = session.user;
   next();
});

export { authGuard };
export type { SessionUser };
