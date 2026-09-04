import { env, siteOrigin } from "@/lib/env";
import { errorHandler, fail } from "@/lib/http";
import { logger } from "@/lib/logger";
import { authGuard } from "@/lib/middleware/auth";
import { originCheck } from "@/lib/middleware/origin";
import {
   BUCKET_MOUNT,
   authRouteLimit,
   bucketIpLimit,
   globalIpLimit,
   userLimit,
} from "@/lib/middleware/rate-limit";
import { accountDeletionHooks } from "@/lib/services/account";
import { assertPrivateKey } from "@/lib/utils/encryption";
import { accountRouter } from "@/routes/account";
import { authFlowRouter } from "@/routes/auth-flow";
import { invitesRouter } from "@/routes/invites";
import { s3Router } from "@/routes/s3";
import { serversRouter } from "@/routes/servers";
import { auth, onUserDeletion } from "@s3-viewer/auth";
import {
   API_CONTRACT_VERSION,
   AUTH_BASE_PATH,
   MINUTE_MS,
   REQUEST_ID_HEADER,
} from "@s3-viewer/types";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";

assertPrivateKey();
onUserDeletion(accountDeletionHooks);

const OBJECT_UPLOAD_PATH = /^\/servers\/[^/]+\/buckets\/[^/]+\/objects$/;
const isObjectUpload = (req: Request): boolean =>
   req.method === "PUT" && OBJECT_UPLOAD_PATH.test(req.path);

const HEADERS_TIMEOUT_MS = 60_000;
const IDLE_TIMEOUT_MS = 2 * MINUTE_MS;

const app = express();

app.use(helmet());
app.set("trust proxy", env.TRUST_PROXY);

// cors must precede the limiters: a 429 without the header reaches the browser
// as an opaque network error instead of the documented RATE_LIMITED code
app.use(
   cors({
      origin: siteOrigin,
      credentials: true,
      methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
      exposedHeaders: [REQUEST_ID_HEADER],
   })
);

app.use((req, res, next) => {
   const id = randomUUID();
   res.locals.requestId = id;
   res.setHeader(REQUEST_ID_HEADER, id);
   if (!isObjectUpload(req)) req.setTimeout(IDLE_TIMEOUT_MS);
   next();
});

// contract version, not the package version: bumped only when a route's shape
// changes, so a web app deployed against an older api can detect the skew
app.get("/health", (_req, res) => {
   res.json({ ok: true, apiVersion: API_CONTRACT_VERSION });
});

app.use(globalIpLimit);
app.use(originCheck);

app.post(
   [
      `${AUTH_BASE_PATH}/email-otp/send-verification-otp`,
      `${AUTH_BASE_PATH}/sign-in/magic-link`,
      `${AUTH_BASE_PATH}/forget-password/email-otp`,
      `${AUTH_BASE_PATH}/email-otp/reset-password`,
   ],
   (_req, res) => fail(res, 404, "Not found")
);
app.use(AUTH_BASE_PATH, (req, res, next) =>
   req.method === "GET" ? next() : authRouteLimit(req, res, next)
);
app.all(`${AUTH_BASE_PATH}/{*any}`, toNodeHandler(auth));

const json = express.json({ limit: "1mb" });
app.use((req, res, next) =>
   isObjectUpload(req) ? next() : json(req, res, next)
);

app.use("/auth-flow", authFlowRouter);

app.use(BUCKET_MOUNT, bucketIpLimit);
app.use(authGuard);
app.use(userLimit);
app.use("/servers", serversRouter);
app.use("/invites", invitesRouter);
app.use("/account", accountRouter);
app.use(BUCKET_MOUNT, s3Router);

app.use((_req, res) => fail(res, 404, "Not found"));
app.use(errorHandler);

// only honoured as constructor options; assigning them post-build is ignored.
// requestTimeout is global and cannot be raised per route, so it stays 0 for
// long uploads; the header phase and idle sockets are bounded instead
const server = createServer(
   { requestTimeout: 0, headersTimeout: HEADERS_TIMEOUT_MS },
   app
);

server.listen(env.PORT, () => {
   logger.info("API listening", { port: env.PORT });
});

const sockets = new Set<Socket>();
server.on("connection", (socket) => {
   sockets.add(socket);
   socket.on("close", () => sockets.delete(socket));
});

const shutdown = (signal: NodeJS.Signals) => {
   logger.info("Shutting down", { signal });
   server.close(() => process.exit(0));
   setTimeout(() => {
      logger.warn("Forcing shutdown", { openSockets: sockets.size });
      for (const socket of sockets) socket.destroy();
      process.exit(1);
   }, 5000).unref();
};

for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"] as const) {
   process.on(signal, () => shutdown(signal));
}
