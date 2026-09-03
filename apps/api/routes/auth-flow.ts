import { asyncHandler, noContent } from "@/lib/http";
import { describeError, logger } from "@/lib/logger";
import {
   authFlowEmailLimit,
   authFlowIpLimit,
} from "@/lib/middleware/rate-limit";
import { input, validate } from "@/lib/middleware/validate";
import { sendAuthFlowEmail } from "@s3-viewer/auth";
import { emailSchema } from "@s3-viewer/types";
import { fromNodeHeaders } from "better-auth/node";
import { Router } from "express";
import { z } from "zod";

const startSchema = z.object({ email: emailSchema });
type StartInput = z.infer<typeof startSchema>;

const authFlowRouter: Router = Router();

authFlowRouter.post(
   "/start",
   authFlowIpLimit,
   validate(startSchema),
   authFlowEmailLimit,
   asyncHandler(async (req, res) => {
      const { email } = input<StartInput>(res);
      try {
         await sendAuthFlowEmail(email, fromNodeHeaders(req.headers));
      } catch (error) {
         logger.error("Auth flow email failed", {
            error: describeError(error),
         });
      }
      noContent(res);
   })
);

export { authFlowRouter };
