// resolve DATA_DIR secrets before @s3-viewer/auth reads them at import time.
import { env, siteOrigin } from "@/lib/env";
import { publicConfig } from "@/lib/config";
import { errorHandler, fail } from "@/lib/http";
import { authGuard } from "@/lib/middleware/auth";
import { authBodyLimit } from "@/lib/middleware/auth-body";
import { privateNoStore } from "@/lib/middleware/cache-control";
import { canonicalPath } from "@/lib/middleware/canonical-path";
import { originCheck } from "@/lib/middleware/origin";
import { requestBodyGuard } from "@/lib/middleware/request-body";
import { recordDenials } from "@/lib/middleware/route";
import { untrustedProxyWarning } from "@/lib/middleware/untrusted-proxy";
import { isObjectUpload } from "@/lib/middleware/upload-body";
import {
   BUCKET_MOUNT,
   TRANSFER_MOUNT,
   authRouteLimit,
   bucketIpLimit,
   byIp,
   globalIpLimit,
   signUpAttemptLimit,
   signUpLimit,
   userLimit,
} from "@/lib/middleware/rate-limit";
import { accountRouter } from "@/routes/account";
import { invitesRouter } from "@/routes/invites";
import { s3Router } from "@/routes/s3";
import { serversRouter } from "@/routes/servers";
import { auth } from "@s3-viewer/auth";
import {
   API_CONTRACT_VERSION,
   AUTH_BASE_PATH,
   CLIENT_IP_HEADER,
   MINUTE_MS,
   REQUEST_ID_HEADER,
} from "@s3-viewer/types";
import { toNodeHandler } from "better-auth/node";
import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";

const IDLE_TIMEOUT_MS = 2 * MINUTE_MS;
const PREFLIGHT_MAX_AGE_SECONDS = 600;
const COMPRESSION_THRESHOLD_BYTES = 8 * 1024;

const createApp = (): Express => {
   const app = express();

   app.use(
      helmet({
         contentSecurityPolicy: {
            useDefaults: false,
            directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
         },
      })
   );
   app.set("trust proxy", env.TRUST_PROXY);
   app.set("etag", false);
   app.use(untrustedProxyWarning());

   app.use(requestBodyGuard());

   // CORS must precede limiters so browsers can read their 429 responses.
   app.use(
      cors({
         origin: siteOrigin,
         credentials: true,
         methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
         exposedHeaders: [REQUEST_ID_HEADER, "ETag", "Retry-After"],
         maxAge: PREFLIGHT_MAX_AGE_SECONDS,
      })
   );

   app.use((req, res, next) => {
      const id = randomUUID();
      res.locals.requestId = id;
      res.setHeader(REQUEST_ID_HEADER, id);
      req.setTimeout(IDLE_TIMEOUT_MS);
      next();
   });

   app.use(canonicalPath);

   app.use(privateNoStore);
   app.use(compression({ threshold: COMPRESSION_THRESHOLD_BYTES }));

   app.get("/health", (_req, res) => {
      res.json({ ok: true, apiVersion: API_CONTRACT_VERSION });
   });

   app.use(globalIpLimit);
   app.use(originCheck);

   const config = publicConfig();
   app.get("/config", (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(config);
   });

   app.use(AUTH_BASE_PATH, (req, res, next) => {
      // Better Auth trusts this header for per-IP throttles; discard caller-supplied values.
      req.headers[CLIENT_IP_HEADER.toLowerCase()] = byIp(req);
      return req.method === "GET" ? next() : authRouteLimit(req, res, next);
   });
   app.post(`${AUTH_BASE_PATH}/sign-up/email`, signUpAttemptLimit, signUpLimit);
   app.all(`${AUTH_BASE_PATH}/{*any}`, authBodyLimit, toNodeHandler(auth));

   app.use([BUCKET_MOUNT, TRANSFER_MOUNT], bucketIpLimit);
   app.use(authGuard);
   app.use(userLimit);

   const json = express.json({ limit: "1mb" });
   app.use((req, res, next) =>
      isObjectUpload(req) ? next() : json(req, res, next)
   );

   app.use("/servers", serversRouter);
   app.use("/invites", invitesRouter);
   app.use("/account", accountRouter);
   app.use(BUCKET_MOUNT, s3Router);

   app.use((_req, res) => fail(res, 404, "Not found"));
   app.use(recordDenials);
   app.use(errorHandler);

   return app;
};

export { createApp };
