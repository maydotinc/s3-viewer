import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { runPrisma } from "./db.mjs";
import {
   apiEnvPath,
   ensureDevInfra,
   landingEnvPath,
   loadEnv,
   root,
   webEnvPath,
} from "./env.mjs";
import { API_URL, LANDING_URL, SITE_URL, runSetup } from "./setup.mjs";

if (!existsSync(apiEnvPath)) {
   process.stdout.write(
      "No apps/api/.env yet — running setup first (`pnpm run setup` to redo it later).\n"
   );
   const unattended = !process.stdin.isTTY || process.env.CI;
   await runSetup(unattended ? ["--yes"] : []);
   process.stdout.write("\n");
}

loadEnv(apiEnvPath);
loadEnv(webEnvPath);

const required = [
   "DATABASE_URL",
   "NEXT_PUBLIC_SITE_URL",
   "NEXT_PUBLIC_API_URL",
   ...(process.env.DATA_DIR
      ? []
      : ["BETTER_AUTH_SECRET", "ENCRYPTION_PRIVATE_KEY"]),
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
   process.stderr.write(
      [
         "",
         `✗ apps/api/.env is missing: ${missing.join(", ")}`,
         "",
         "  Fill them in by hand (apps/api/.env.example documents every variable),",
         "  or let the wizard regenerate the file:",
         "",
         "      pnpm run setup",
         "",
      ].join("\n")
   );
   process.exit(1);
}

if (!(await ensureDevInfra(process.env, { quiet: true }))) process.exit(1);
runPrisma("deploy");

const landing =
   existsSync(landingEnvPath) || Boolean(process.env.LANDING_ORIGIN);
process.stdout.write(
   [
      "",
      "Starting S3 Viewer:",
      `  web      ${SITE_URL}`,
      `  api      ${API_URL}`,
      ...(landing ? [`  landing  ${LANDING_URL}`] : []),
      "",
      "",
   ].join("\n")
);

const child = spawn(
   "pnpm",
   [
      "exec",
      "turbo",
      "run",
      "dev",
      "--filter=api",
      "--filter=web",
      ...(landing ? ["--filter=landing"] : []),
   ],
   { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
);

for (const signal of ["SIGINT", "SIGTERM"]) {
   process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
   process.exit(signal ? 1 : (code ?? 0));
});
