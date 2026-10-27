import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      alias: {
         "@s3-viewer/ui": path.resolve(import.meta.dirname, "src"),
      },
   },
   test: {
      include: ["**/*.test.ts"],
      exclude: ["node_modules", "dist"],
   },
});
