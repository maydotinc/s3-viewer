import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
   },
   test: {
      include: ["**/*.test.ts"],
      exclude: ["node_modules", "dist"],
      env: {
         NODE_ENV: "test",
         DATABASE_URL: "postgresql://user:pass@localhost:5432/s3viewer",
         BETTER_AUTH_SECRET: "test-secret-at-least-thirty-two-chars",
         ENCRYPTION_PRIVATE_KEY: "test",
         NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
         NEXT_PUBLIC_API_URL: "http://localhost:5001",
         // pinned empty so a developer's own apps/api/.env, which dotenv loads
         // into these tests, cannot change what they assert
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
         UPLOAD_MEMORY_BUDGET_BYTES: "",
         UPLOAD_IDLE_TIMEOUT_MS: "",
      },
   },
});
