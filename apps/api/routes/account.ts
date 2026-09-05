import { ApiHttpError, asyncHandler, noContent } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { accountSummary } from "@/lib/services/account";
import { auth } from "@s3-viewer/auth";
import {
   ErrorCode,
   HOUR_MS,
   SESSION_FRESH_HOURS,
   passwordSchema,
} from "@s3-viewer/types";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

const setPasswordSchema = z.object({ password: passwordSchema });
type SetPasswordInput = z.infer<typeof setPasswordSchema>;

const accountRouter: Router = Router();

const getSummary = async (req: Request, res: Response) => {
   res.json(await accountSummary(requireUser(req)));
};

const FRESH_SESSION_MS = SESSION_FRESH_HOURS * HOUR_MS;

// better auth keeps `set-password` server-only: it is how an account that
// signed up with github gets its first password without knowing one. A
// stolen cookie must not be enough to claim the account, so the session has
// to be as fresh as account deletion requires
const setPassword = async (req: Request, res: Response) => {
   requireUser(req);
   const createdAt = new Date(req.session?.createdAt ?? 0).getTime();
   if (Date.now() - createdAt >= FRESH_SESSION_MS) {
      throw new ApiHttpError(
         403,
         "For your security, setting a password needs a sign-in from the last 24 hours.",
         ErrorCode.SESSION_STALE
      );
   }
   const { password } = input<SetPasswordInput>(res);
   await auth.api.setPassword({
      body: { newPassword: password },
      headers: fromNodeHeaders(req.headers),
   });
   noContent(res);
};

accountRouter.get("/summary", asyncHandler(getSummary));
accountRouter.post(
   "/password",
   ...validatedRoute(setPasswordSchema, setPassword)
);

export { accountRouter };
