import { env } from "@/lib/env";
import { asyncHandler, noContent } from "@/lib/http";
import { requireUser } from "@/lib/middleware/authorize";
import { validatedRoute } from "@/lib/middleware/route";
import { input } from "@/lib/middleware/validate";
import { accountSummary } from "@/lib/services/account";
import { auth } from "@s3-viewer/auth";
import { passwordSchema } from "@s3-viewer/types";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

const setPasswordSchema = z.object({ password: passwordSchema });
type SetPasswordInput = z.infer<typeof setPasswordSchema>;

const accountRouter: Router = Router();

const getSummary = async (req: Request, res: Response) => {
   res.json(await accountSummary(requireUser(req)));
};

// better auth keeps `set-password` server-only: it is how an account that
// signed up by code or github gets its first password without knowing one
const setPassword = async (req: Request, res: Response) => {
   requireUser(req);
   const { password } = input<SetPasswordInput>(res);
   await auth.api.setPassword({
      body: { newPassword: password },
      headers: fromNodeHeaders(req.headers),
   });
   noContent(res);
};

accountRouter.get("/summary", asyncHandler(getSummary));
if (env.PASSWORD_LOGIN_ENABLED) {
   accountRouter.post(
      "/password",
      ...validatedRoute(setPasswordSchema, setPassword)
   );
}

export { accountRouter };
