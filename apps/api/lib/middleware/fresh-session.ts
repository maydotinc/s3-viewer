import { ApiHttpError } from "@/lib/http";
import {
   ErrorCode,
   SESSION_FRESH_HOURS,
   isSessionFresh,
} from "@s3-viewer/types";
import type { Request } from "express";

// a stolen long-lived cookie must not be enough to take over a server or blind its log.
const requireFreshSession = (req: Request, action: string): void => {
   if (isSessionFresh(req.session?.createdAt ?? 0)) return;
   throw new ApiHttpError(
      403,
      `For your security, ${action} needs a sign-in from the last ${SESSION_FRESH_HOURS} hours.`,
      ErrorCode.SESSION_STALE
   );
};

export { requireFreshSession };
