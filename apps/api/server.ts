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
import { assertPrivateKey } from "@/lib/utils/encryption";
import { authFlowRouter } from "@/routes/auth-flow";
import { invitesRouter } from "@/routes/invites";
import { s3Router } from "@/routes/s3";
import { serversRouter } from "@/routes/servers";
import { auth } from "@s3-viewer/auth";
import { AUTH_BASE_PATH } from "@s3-viewer/types";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";
import type { Socket } from "node:net";

assertPrivateKey();

const OBJECT_UPLOAD_PATH = /^\/servers\/[^/]+\/buckets\/[^/]+\/objects$/;
const isObjectUpload = (req: Request): boolean =>
   req.method === "PUT" && OBJECT_UPLOAD_PATH.test(req.path);

const app = express();

app.use(helmet());
app.set("trust proxy", env.TRUST_PROXY);
app.use(globalIpLimit);
app.use(
   cors({
      origin: siteOrigin,
      credentials: true,
      methods: ["GET", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
   })
);

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
app.use(BUCKET_MOUNT, s3Router);

app.use((_req, res) => fail(res, 404, "Not found"));
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
   logger.info("API listening", { port: env.PORT });
});

server.requestTimeout = 0;
server.headersTimeout = 60_000;

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
