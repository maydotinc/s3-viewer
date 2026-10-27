import { defineConfig } from "tsup";

export default defineConfig({
   entryPoints: ["server.ts", "verify-email.ts"],
   format: ["esm"],
   target: "node22",
   sourcemap: true,
   clean: true,
   noExternal: [/@s3-viewer\/.*/],
   // keep react-dom/server external to avoid ESM require-shim failures.
   external: [
      "@react-email/components",
      "@react-email/render",
      "nodemailer",
      "react",
      "react-dom",
      "resend",
   ],
});
