import { asyncHandler, noContent } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { requireFreshSession } from "@/lib/middleware/fresh-session";
import { authRouteLimit } from "@/lib/middleware/rate-limit";
import { validatedRoute } from "@/lib/middleware/route";
import { accountSummary } from "@/lib/services/account";
import { auth, dropResetLinks } from "@s3-viewer/auth";
import { passwordSchema } from "@s3-viewer/shared";
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
   const user = requireUser(req);
   requireFreshSession(req, "setting a password");
   const { password } = input;
   const headers = fromNodeHeaders(req.headers);
   await auth.api.setPassword({ body: { newPassword: password }, headers });
   // a retry would hit PASSWORD_ALREADY_SET, so the other sessions go even when the drop fails
   try {
      await dropResetLinks(user.id);
   } finally {
      await auth.api.revokeOtherSessions({ headers });
   }
   noContent(res);
};

accountRouter.get("/summary", asyncHandler(getSummary));
accountRouter.post(
   "/password",
   authRouteLimit,
   ...validatedRoute(setPasswordSchema, setPassword)
);

export { accountRouter };
