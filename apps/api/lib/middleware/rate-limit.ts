import { BUCKETS_PATH, SERVER_MOUNT, underAnyServer } from "@/lib/constants";
import { env } from "@/lib/env";
import { windowStore } from "./rate-limit-store";
import { sharedWindowCounter } from "@s3-viewer/db/rate-limit";
import {
   DAY_MS,
   ErrorCode,
   HOUR_MS,
   MINUTE_MS,
   TRANSFERS_PATH,
   SECOND_MS,
   memoryWindowCounter,
   ttlMap,
} from "@s3-viewer/shared";
import type { Request, RequestHandler, Response } from "express";
import rateLimit, {
   ipKeyGenerator,
   type Options,
   type RateLimitInfo,
} from "express-rate-limit";

const BUCKET_MOUNT = `${SERVER_MOUNT}${BUCKETS_PATH}`;
const TRANSFER_MOUNT = `${SERVER_MOUNT}${TRANSFERS_PATH}`;
const TRANSFER_ROUTE = new RegExp(
   `${underAnyServer(TRANSFERS_PATH)}(/|$)`,
   "i"
);
const OBJECT_ROUTE = new RegExp(
   `${underAnyServer(BUCKETS_PATH, TRANSFERS_PATH)}(/|$)`,
   "i"
);

const RATE_LIMITED = {
   message: "Too many requests. Please try again later.",
   code: ErrorCode.RATE_LIMITED,
};

const TRANSFER_NOT_STARTED = {
   ...RATE_LIMITED,
   code: ErrorCode.TRANSFER_NOT_STARTED,
};

const refusal = (req: Request) =>
   TRANSFER_ROUTE.test(`${req.baseUrl}${req.path}`)
      ? TRANSFER_NOT_STARTED
      : RATE_LIMITED;

type KeyGenerator = (req: Request, res: Response) => string;

type LimiterOptions = {
   skip?: (req: Request) => boolean;
   skipFailedRequests?: boolean;
   shared?: string;
};

const MAX_REFUSED_KEYS = 10_000;
// in-process windows need a cap express-rate-limit's memory store did without; only a flood of addresses reaches it.
const MAX_MEMORY_KEYS = 100_000;

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? "");

const limiter = (
   windowMs: number,
   limit: number,
   keyGenerator: KeyGenerator = byIp,
   { skip, skipFailedRequests = false, shared }: LimiterOptions = {}
): RequestHandler => {
   const postgres = shared !== undefined && env.RATE_LIMIT_STORE === "postgres";
   const options = {
      windowMs,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: refusal,
      skipFailedRequests,
      keyGenerator,
      store: postgres
         ? windowStore(sharedWindowCounter, shared, false)
         : windowStore(
              memoryWindowCounter(MAX_MEMORY_KEYS),
              shared ?? "",
              true
           ),
      ...(skip ? { skip } : {}),
   } satisfies Partial<Options>;
   if (!postgres) return rateLimit(options);

   const refusedUntil = ttlMap<string, number>(MAX_REFUSED_KEYS);
   const windowSeconds = Math.ceil(windowMs / SECOND_MS);
   // same draft-7 headers express-rate-limit sent on the first refusal.
   const refuse = (req: Request, res: Response, until: number): void => {
      const resetSeconds = Math.ceil((until - Date.now()) / SECOND_MS);
      res.setHeader("RateLimit-Policy", `${limit};w=${windowSeconds}`);
      res.setHeader(
         "RateLimit",
         `limit=${limit}, remaining=0, reset=${resetSeconds}`
      );
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json(refusal(req));
   };
   const across = rateLimit({
      ...options,
      handler: (
         req: Request & { rateLimit?: RateLimitInfo },
         res,
         _next,
         used
      ) => {
         const resetAt = req.rateLimit?.resetTime?.getTime();
         if (resetAt !== undefined)
            refusedUntil.set(keyGenerator(req, res), resetAt, resetAt);
         res.status(used.statusCode).json(refusal(req));
      },
   });
   return (req, res, next) => {
      if (skip?.(req)) return next();
      const key = keyGenerator(req, res);
      const until = refusedUntil.get(key);
      if (until === undefined) return across(req, res, next);
      refuse(req, res, until);
   };
};

const byUser = (req: Request) => req.user?.id ?? byIp(req);

const globalIpLimit = limiter(MINUTE_MS, 1200, byIp, {
   skip: (req) => OBJECT_ROUTE.test(req.path),
});

const bucketIpLimit = limiter(MINUTE_MS, 6000, byIp);

// routes that check a password or code share one tight per-IP bucket; posts that check neither get a generous one of
// their own, so a script behind an office NAT cannot sign colleagues out of their sessions. Better Auth's per-address
// throttles stay the fine control. any path not listed here, however spelled, takes the tight bucket.
const SESSION_AUTH_PATHS: ReadonlySet<string> = new Set([
   "/sign-out",
   "/update-user",
   "/revoke-session",
   "/revoke-sessions",
   "/revoke-other-sessions",
]);

const authRouteLimit = limiter(MINUTE_MS, 20, byIp, { shared: "auth:" });

const authSessionLimit = limiter(MINUTE_MS, 120, byIp, {
   shared: "auth-session:",
});

const authLimit: RequestHandler = (req, res, next) =>
   (SESSION_AUTH_PATHS.has(req.path) ? authSessionLimit : authRouteLimit)(
      req,
      res,
      next
   );

const userLimit = limiter(MINUTE_MS, 1800, byUser);

// the login form's wrong-password fallback returns 422; only successful signups spend this budget.
const signUpLimit = limiter(HOUR_MS, 10, byIp, {
   skipFailedRequests: true,
   shared: "signup:",
});

const signUpAttemptLimit = limiter(HOUR_MS, 100, byIp, {
   shared: "signup-attempt:",
});

const connectLimit = limiter(MINUTE_MS, 30, byUser, { shared: "connect:" });

// MAX_SERVERS_PER_USER caps what one account holds, not how often it can create and delete:
// each deleted server leaves audit rows that every hourly sweep revisits until retention ends.
const serverCreateLimit: RequestHandler[] = [
   connectLimit,
   limiter(DAY_MS, 50, byUser, { shared: "server-create-day:" }),
];

const inviteLimit: RequestHandler[] = [
   limiter(MINUTE_MS, 5, byUser, { shared: "invite:" }),
   limiter(HOUR_MS, 10, byUser, { shared: "invite-hour:" }),
   limiter(DAY_MS, 20, byUser, { shared: "invite-day:" }),
];

const existsLimit = limiter(MINUTE_MS, 60, byUser, { shared: "exists:" });

const archiveLimit = limiter(MINUTE_MS, 60, byUser, { shared: "archive:" });

// capacity refusals do not spend a ticket's failures, so redemption needs its own cap.
const archiveDownloadLimit = limiter(MINUTE_MS, 60, byUser, {
   shared: "archive-download:",
});

const auditSearchLimit = limiter(MINUTE_MS, 60, byUser, {
   shared: "audit-search:",
});

const auditBulkLimit = limiter(10 * MINUTE_MS, 10, byUser, {
   shared: "export:",
});

const auditVerifyLimit = limiter(10 * MINUTE_MS, 60, byUser, {
   shared: "audit-verify:",
});

const bucketCreateLimit: RequestHandler[] = [
   limiter(MINUTE_MS, 20, byUser, { shared: "bucket-create:" }),
   limiter(DAY_MS, 200, byUser, { shared: "bucket-create-day:" }),
];

export {
   BUCKET_MOUNT,
   TRANSFER_MOUNT,
   archiveDownloadLimit,
   archiveLimit,
   auditBulkLimit,
   auditSearchLimit,
   auditVerifyLimit,
   authLimit,
   authRouteLimit,
   bucketCreateLimit,
   bucketIpLimit,
   byIp,
   connectLimit,
   existsLimit,
   globalIpLimit,
   inviteLimit,
   serverCreateLimit,
   signUpAttemptLimit,
   signUpLimit,
   userLimit,
};
