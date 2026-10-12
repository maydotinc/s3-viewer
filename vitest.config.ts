import { defineConfig } from "vitest/config";

export default defineConfig({
   test: {
      projects: [
         "apps/*",
         "packages/*",
         { test: { name: "scripts", include: ["scripts/**/*.test.mjs"] } },
      ],
      passWithNoTests: true,
   },
});
