import { apiEnvPath, isMain, loadEnv, must } from "./env.mjs";

const COMMANDS = {
   deploy: ["migrate", "deploy"],
   migrate: ["migrate", "dev"],
   generate: ["generate"],
   status: ["migrate", "status"],
};

export function runPrisma(command, extraEnv = {}) {
   must(
      "pnpm",
      [
         "--filter",
         "@s3-viewer/db",
         "exec",
         "prisma",
         ...COMMANDS[command],
         "--schema=prisma/schema.prisma",
      ],
      extraEnv
   );
}

function main() {
   const command = process.argv[2];
   if (!command || !(command in COMMANDS)) {
      process.stderr.write(
         `\n❌ Usage: node scripts/db.mjs <${Object.keys(COMMANDS).join(" | ")}>\n\n`
      );
      process.exit(1);
   }

   loadEnv(apiEnvPath);
   if (command !== "generate" && !process.env.DATABASE_URL) {
      process.stderr.write(
         [
            "",
            "❌ DATABASE_URL isn't set, so Prisma has no database to talk to.",
            "",
            "  Run `pnpm run setup` to create apps/api/.env (it can run Postgres in Docker",
            "  for you), or set DATABASE_URL in apps/api/.env by hand.",
            "",
         ].join("\n")
      );
      process.exit(1);
   }

   runPrisma(command);
}

if (isMain(import.meta.url)) main();
