import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
   entryPoints: ["server.ts"],
   format: ["esm"],
   target: "node20",
   sourcemap: true,
   clean: true,
   noExternal: [/@s3-viewer\/.*/],
   external: ["resend"],
   onSuccess: options.watch ? "tsx dist/server.js" : undefined,
   ...options,
}));
