import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const integrationUrl = process.env.DATABASE_INTEGRATION_URL;
const databaseUrl = integrationUrl ? new URL(integrationUrl) : undefined;
if (databaseUrl) {
   // a non-UTC session zone catches raw-SQL dates that depend on it.
   const options = databaseUrl.searchParams.get("options");
   databaseUrl.searchParams.set(
      "options",
      [options, "-c timezone=America/Toronto"].filter(Boolean).join(" ")
   );
}

export default defineConfig({
   resolve: {
      alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
   },
   test: {
      include: ["**/*.test.ts"],
      exclude: ["node_modules", "dist"],
      env: {
         NODE_ENV: "test",
         DATABASE_URL:
            databaseUrl?.toString() ??
            "postgresql://user:pass@localhost:5432/s3viewer",
         BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-chars",
         ENCRYPTION_PRIVATE_KEY: "test",
         NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
         NEXT_PUBLIC_API_URL: "http://localhost:5001",
         RATE_LIMIT_STORE: "memory",
         // pin empty values so a developer's .env cannot change test behavior.
         DATA_DIR: "",
         EMAIL_TRANSPORT: "",
         RESEND_KEY: "",
         SMTP_URL: "",
         GITHUB_CLIENT_ID: "",
         GITHUB_CLIENT_SECRET: "",
         ALLOW_PRIVATE_ENDPOINTS: "",
         UPLOAD_PART_BYTES: "",
         MAX_CONCURRENT_UPLOADS: "",
         MAX_USER_UPLOADS: "",
         MAX_IP_UPLOADS: "",
         UPLOAD_SLOT_MAX_MS: "",
         UPLOAD_MEMORY_BUDGET_BYTES: "",
         UPLOAD_IDLE_TIMEOUT_MS: "",
         COOKIE_SAMESITE: "",
         SIGNUP_MODE: "",
         ALLOWED_EMAIL_DOMAINS: "",
         TRUST_PROXY: "",
         MAX_UPLOAD_BYTES: "",
         MAX_ARCHIVE_OBJECTS: "",
         MAX_ARCHIVE_BYTES: "",
         S3_REQUESTS_PER_MINUTE: "",
         S3_MAX_SOCKETS_PER_HOST: "",
         S3_MAX_TOTAL_SOCKETS: "",
         S3_MAX_INFLIGHT_PER_SERVER: "",
         S3_MAX_INFLIGHT_PER_USER: "",
         S3_REQUEST_TIMEOUT_MS: "",
         AUDIT_RETENTION_DAYS: "",
         AUDIT_RETENTION_MIN_DAYS: "",
         UNVERIFIED_ACCOUNT_TTL_DAYS: "",
         KEEP_ALIVE_TIMEOUT_MS: "",
         AUDIT_CHAIN_KEY: "",
         ACCEPT_NEW_ENCRYPTION_KEY: "",
         ACCEPT_NEW_AUDIT_CHAIN_KEY: "",
         EMAIL_FROM: "",
         SUPPORT_EMAIL: "",
         LOG_LEVEL: "",
         PRISMA_LOG_QUERIES: "",
      },
   },
});
