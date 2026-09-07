import { env } from "@/lib/env";
import { postgresStore } from "@/lib/middleware/rate-limit-store";
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

type LimiterOptions = {
   skip?: (req: Request) => boolean;
   skipFailedRequests?: boolean;
   // set on the security-relevant limiters only: with RATE_LIMIT_STORE=postgres
   // their counters move to the database so every replica shares one budget.
   // The volume limiters stay in memory on purpose — a database write per
   // request, before auth, would amplify a flood instead of absorbing it.
   shared?: string;
};

const limiter = (
   windowMs: number,
   limit: number,
   keyGenerator?: KeyGenerator,
   { skip, skipFailedRequests = false, shared }: LimiterOptions = {}
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
      ...(shared && env.RATE_LIMIT_STORE === "postgres"
         ? { store: postgresStore(shared) }
         : {}),
   });

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "");

const byUser = (req: Request) => req.user?.id ?? byIp(req);

const globalIpLimit = limiter(MINUTE_MS, 1200, byIp, {
   skip: (req) => BUCKET_ROUTE.test(req.path),
});

const bucketIpLimit = limiter(MINUTE_MS, 6000, byIp);

const authRouteLimit = limiter(MINUTE_MS, 20, undefined, { shared: "auth:" });

const userLimit = limiter(MINUTE_MS, 1800, byUser);

// accounts actually created per ip; the login page's sign-up fallback for a
// wrong password answers 422 and must not spend this budget
const signUpLimit = limiter(HOUR_MS, 10, byIp, {
   skipFailedRequests: true,
   shared: "signup:",
});

const connectLimit = limiter(MINUTE_MS, 30, byUser, { shared: "connect:" });

const inviteLimit = limiter(MINUTE_MS, 20, byUser, { shared: "invite:" });

// one HeadObject upstream per key: a cheap request here is an expensive fan-out
const existsLimit = limiter(MINUTE_MS, 60, byUser, { shared: "exists:" });

export {
   BUCKET_MOUNT,
   authRouteLimit,
   bucketIpLimit,
   connectLimit,
   existsLimit,
   globalIpLimit,
   inviteLimit,
   signUpLimit,
   userLimit,
};
