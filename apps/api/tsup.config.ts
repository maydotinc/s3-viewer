import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
   entryPoints: ["server.ts"],
   format: ["esm"],
   target: "node20",
   sourcemap: true,
   clean: true,
   noExternal: [/@s3-viewer\/.*/],
   // the workspace packages are source-only, so they have to be inlined — but
   // the email stack they pull in must not be: react-dom/server is CJS, and
   // esbuild's require shim throws on it inside an ESM bundle.
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
