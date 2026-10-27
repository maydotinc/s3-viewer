import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
   test: {
      include: ["**/*.test.ts"],
      exclude: ["**/node_modules/**", "**/.next/**"],
      env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
   },
});
