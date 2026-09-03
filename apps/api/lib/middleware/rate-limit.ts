import { input } from "@/lib/middleware/validate";
import { MINUTE_MS } from "@s3-viewer/types";
import type { Request, RequestHandler, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const RATE_LIMITED = {
   message: "Too many requests. Please try again later.",
   code: "RATE_LIMITED",
};

type KeyGenerator = (req: Request, res: Response) => string;

const limiter = (
   windowMs: number,
   limit: number,
   keyGenerator?: KeyGenerator
): RequestHandler =>
   rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: RATE_LIMITED,
      ...(keyGenerator ? { keyGenerator } : {}),
   });

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "");

const byUser = (req: Request) => req.user?.id ?? byIp(req);

const globalIpLimit = limiter(MINUTE_MS, 300);

const authRouteLimit = limiter(MINUTE_MS, 20);

const userLimit = limiter(MINUTE_MS, 600, byUser);

const connectLimit = limiter(MINUTE_MS, 30, byUser);

const authFlowIpLimit = limiter(MINUTE_MS, 5);

const authFlowEmailLimit = limiter(
   10 * MINUTE_MS,
   5,
   (_req, res) => input<{ email: string }>(res).email
);

export {
   authFlowEmailLimit,
   authFlowIpLimit,
   authRouteLimit,
   connectLimit,
   globalIpLimit,
   userLimit,
};
