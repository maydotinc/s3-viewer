import { ApiHttpError, asyncHandler, noContent } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { authRouteLimit } from "@/lib/middleware/rate-limit";
import { validatedRoute } from "@/lib/middleware/route";
import { accountSummary } from "@/lib/services/account";
import { auth } from "@s3-viewer/auth";
import {
   ErrorCode,
   isSessionFresh,
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

const setPassword = async (
   req: Request,
   res: Response,
   input: SetPasswordInput
) => {
   requireUser(req);
   if (!isSessionFresh(req.session?.createdAt ?? 0)) {
      throw new ApiHttpError(
         403,
         `For your security, setting a password needs a sign-in from the last ${SESSION_FRESH_HOURS} hours.`,
         ErrorCode.SESSION_STALE
      );
   }
   const { password } = input;
   const headers = fromNodeHeaders(req.headers);
   await auth.api.setPassword({ body: { newPassword: password }, headers });
   await auth.api.revokeOtherSessions({ headers });
   noContent(res);
};

accountRouter.get("/summary", asyncHandler(getSummary));
accountRouter.post(
   "/password",
   authRouteLimit,
   ...validatedRoute(setPasswordSchema, setPassword)
);

export { accountRouter };
