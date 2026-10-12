// resolve DATA_DIR secrets before @s3-viewer/auth reads them at import time.
import { env, siteOrigin } from "@/lib/env";
import { createApp } from "./app";
import { setAuditChainKey } from "@/lib/audit/chain";
import { flushAudits, flushAuditsWithin } from "@/lib/audit/writer";
import { banner, logger } from "@/lib/logger";
import { startMaintenance } from "@/lib/maintenance";
import { accountDeletionHooks } from "@/lib/services/account";
import { assertPrivateKey } from "@/lib/utils/encryption";
import { assertInstanceSecrets } from "@/lib/utils/instance-secrets";
import { onUserDeletion } from "@s3-viewer/auth";
import { configureEmail } from "@s3-viewer/email";
import { describeError } from "@s3-viewer/types";
import { createServer } from "node:http";
import type { Socket } from "node:net";

assertPrivateKey();
delete process.env.BETTER_AUTH_SECRET;
delete process.env.ENCRYPTION_PRIVATE_KEY;
delete process.env.AUDIT_CHAIN_KEY;
onUserDeletion(accountDeletionHooks);

// NODE_ENV defaults to development, so also require a local site before printing live links.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localSite = LOCAL_HOSTS.has(new URL(siteOrigin).hostname);

configureEmail({
   transport: env.EMAIL_TRANSPORT,
   from: env.EMAIL_FROM,
   resendKey: env.RESEND_KEY,
   smtpUrl: env.SMTP_URL,
   logBodies: env.NODE_ENV === "development" && localSite,
});

const HEADERS_TIMEOUT_MS = env.KEEP_ALIVE_TIMEOUT_MS + 5_000;
const FORCED_FLUSH_MS = 3_000;
const SHUTDOWN_GRACE_MS = 5_000;

const app = createApp();

// body deadlines live in middleware and upload watchdogs, so no global request deadline.
const server = createServer(
   {
      requestTimeout: 0,
      headersTimeout: HEADERS_TIMEOUT_MS,
      keepAliveTimeout: env.KEEP_ALIVE_TIMEOUT_MS,
   },
   app
);

const EMAIL_NOTE: Record<typeof env.EMAIL_TRANSPORT, string> = {
   none: "none (password reset & invites off)",
   smtp: "smtp",
   resend: "resend",
};

const listen = (): void => {
   server.listen(env.PORT, () => {
      logger.info("API listening", { port: env.PORT });
      banner([
         "🪣 S3 Viewer API is up",
         `   🌐 web      ${env.NEXT_PUBLIC_SITE_URL}`,
         `   🔌 api      ${env.NEXT_PUBLIC_API_URL}`,
         `   📬 email    ${EMAIL_NOTE[env.EMAIL_TRANSPORT]}`,
      ]);
      startMaintenance();
   });
};

assertInstanceSecrets().then(
   (auditChainKey) => {
      setAuditChainKey(auditChainKey);
      listen();
   },
   (error: unknown) => {
      logger.error("Refusing to start", { error: describeError(error) });
      process.exit(1);
   }
);

const sockets = new Set<Socket>();
server.on("connection", (socket) => {
   sockets.add(socket);
   socket.on("close", () => sockets.delete(socket));
});

let shuttingDown = false;

const shutdown = (signal: NodeJS.Signals) => {
   if (shuttingDown) return;
   shuttingDown = true;
   let exitCode = 0;
   logger.info("Shutting down", { signal });
   server.close(() => void flushAudits().finally(() => process.exit(exitCode)));
   setTimeout(() => {
      exitCode = 1;
      logger.warn("Forcing shutdown", { openSockets: sockets.size });
      for (const socket of sockets) socket.destroy();
      void flushAuditsWithin(FORCED_FLUSH_MS).finally(() =>
         process.exit(exitCode)
      );
   }, SHUTDOWN_GRACE_MS).unref();
};

for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"] as const) {
   process.on(signal, () => shutdown(signal));
}
