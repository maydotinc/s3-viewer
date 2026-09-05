import { ErrorCode, HOUR_MS, MINUTE_MS } from "@s3-viewer/types";
import type { Request, RequestHandler, Response } from "express";

const BUCKET_MOUNT = "/servers/:serverId/buckets";
const BUCKET_ROUTE = /^\/servers\/[^/]+\/buckets(\/|$)/i;
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const RATE_LIMITED = {
   message: "Too many requests. Please try again later.",
   code: ErrorCode.RATE_LIMITED,
};

type KeyGenerator = (req: Request, res: Response) => string;

const limiter = (
   windowMs: number,
   limit: number,
   keyGenerator?: KeyGenerator,
   skip?: (req: Request) => boolean,
   skipFailedRequests = false
): RequestHandler =>
   rateLimit({
      windowMs,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: RATE_LIMITED,
      skipFailedRequests,
      ...(keyGenerator ? { keyGenerator } : {}),
      ...(skip ? { skip } : {}),
   });

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "");

const byUser = (req: Request) => req.user?.id ?? byIp(req);

const globalIpLimit = limiter(MINUTE_MS, 1200, byIp, (req) =>
   BUCKET_ROUTE.test(req.path)
);

const bucketIpLimit = limiter(MINUTE_MS, 6000, byIp);

const authRouteLimit = limiter(MINUTE_MS, 20);

const userLimit = limiter(MINUTE_MS, 1800, byUser);

// accounts actually created per ip; the login page's sign-up fallback for a
// wrong password answers 422 and must not spend this budget
const signUpLimit = limiter(HOUR_MS, 10, byIp, undefined, true);

const connectLimit = limiter(MINUTE_MS, 30, byUser);

const inviteLimit = limiter(MINUTE_MS, 20, byUser);

export {
   BUCKET_MOUNT,
   authRouteLimit,
   bucketIpLimit,
   connectLimit,
   globalIpLimit,
   inviteLimit,
   signUpLimit,
   userLimit,
};
