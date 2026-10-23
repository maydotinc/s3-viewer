import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
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
   onSuccess: options.watch ? "tsx dist/server.js" : undefined,
   ...options,
}));
