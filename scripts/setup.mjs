import { generateKeyPairSync, randomBytes } from "node:crypto";
import {
   copyFileSync,
   existsSync,
   readFileSync,
   rmSync,
   writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { runPrisma } from "./db.mjs";
import {
   apiEnvPath,
   ensureDevInfra,
   landingEnvPath,
   parseEnvFile,
   setKey,
   webEnvPath,
} from "./env.mjs";

export const SITE_URL = "http://localhost:3000";
export const API_URL = "http://localhost:5001";
export const LANDING_URL = "http://localhost:3001";
export const DEV_DATABASE_URL =
   "postgresql://s3viewer:s3viewer@localhost:5432/s3viewer";
export const SMTP_URL = "smtp://localhost:1025";
export const MAILPIT_URL = "http://localhost:8025";
export const MINIO_ENDPOINT = "http://localhost:9000";
export const MINIO_CONSOLE = "http://localhost:9001";
export const MINIO_CREDENTIALS = "minioadmin / minioadmin";
export const DEMO_BUCKET = "demo";

const PROFILES_COMMENT =
   "Docker services the dev scripts manage for you (docker-compose.dev.yml).";

export function generateSecrets() {
   const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 4096 });
   return {
      betterAuthSecret: randomBytes(32).toString("base64"),
      encryptionPrivateKey: privateKey
         .export({ type: "pkcs8", format: "pem" })
         .trim(),
   };
}

export function composeProfiles(choices) {
   return [
      choices.docker ? "core" : null,
      choices.email ? "email" : null,
      choices.demo ? "demo" : null,
   ]
      .filter(Boolean)
      .join(",");
}

export function buildApiEnv(example, choices, secrets) {
   let content = setKey(example, "DATABASE_URL", choices.databaseUrl);
   content = setKey(content, "BETTER_AUTH_SECRET", secrets.betterAuthSecret);
   content = setKey(
      content,
      "ENCRYPTION_PRIVATE_KEY",
      secrets.encryptionPrivateKey
   );
   content = setKey(content, "NEXT_PUBLIC_SITE_URL", SITE_URL);
   content = setKey(content, "NEXT_PUBLIC_API_URL", API_URL);
   content = setKey(
      content,
      "EMAIL_TRANSPORT",
      choices.email ? "smtp" : "none"
   );
   content = setKey(content, "SMTP_URL", choices.email ? SMTP_URL : "");
   content = setKey(
      content,
      "ALLOW_PRIVATE_ENDPOINTS",
      choices.demo ? "true" : ""
   );
   return setKey(
      content,
      "COMPOSE_PROFILES",
      composeProfiles(choices),
      PROFILES_COMMENT
   );
}

export function buildWebEnv(example, choices) {
   let content = setKey(example, "NEXT_PUBLIC_SITE_URL", SITE_URL);
   content = setKey(content, "NEXT_PUBLIC_API_URL", API_URL);
   return setKey(content, "LANDING_ORIGIN", choices.landing ? LANDING_URL : "");
}

export function buildLandingEnv(example) {
   return setKey(example, "NEXT_PUBLIC_SITE_URL", SITE_URL);
}

async function ask(rl, question, fallback) {
   if (fallback === undefined) return (await rl.question(question)).trim();
   const suffix = fallback ? " (Y/n) " : " (y/N) ";
   const answer = (await rl.question(`${question}${suffix}`))
      .trim()
      .toLowerCase();
   return answer === "" ? fallback : answer.startsWith("y");
}

// `--no-docker` means the contributor brings their own database, so a
// DATABASE_URL already in the environment is the answer they'd type: it seeds
// the prompt instead of being thrown away.
export function databaseUrlQuestion(seeded) {
   return seeded
      ? `  Postgres connection string [${seeded}]: `
      : "  Postgres connection string: ";
}

export function pickDatabaseUrl(answer, seeded) {
   return answer.trim() || seeded.trim();
}

async function collectChoices({ interactive, noDocker }) {
   const seeded = noDocker ? (process.env.DATABASE_URL ?? "") : "";
   const defaults = {
      docker: !noDocker,
      databaseUrl: noDocker ? seeded : DEV_DATABASE_URL,
      email: !noDocker,
      demo: false,
      landing: false,
   };
   if (!interactive) {
      if (!defaults.databaseUrl) {
         process.stderr.write(
            "\n✗ --no-docker needs a database: set DATABASE_URL in the environment and re-run.\n\n"
         );
         process.exit(1);
      }
      return defaults;
   }

   process.stdout.write(
      [
         "",
         "🪣 S3 Viewer setup",
         "==================",
         "Postgres is the only thing S3 Viewer can't run without — everything else",
         "is optional. Press Enter to accept the default in brackets.",
         "",
      ].join("\n")
   );

   const rl = createInterface({ input: process.stdin, output: process.stdout });
   try {
      const choices = { ...defaults };
      if (!noDocker) {
         choices.docker = await ask(
            rl,
            "Run Postgres in Docker for you?",
            true
         );
      }
      if (!choices.docker) {
         choices.databaseUrl = pickDatabaseUrl(
            await ask(rl, databaseUrlQuestion(seeded)),
            seeded
         );
         if (!choices.databaseUrl) {
            process.stderr.write(
               "✗ S3 Viewer needs a database — nothing else to fall back to.\n"
            );
            process.exit(1);
         }
      }
      choices.email = await ask(
         rl,
         "Catch outgoing email in a local inbox? (runs mailpit in Docker)",
         !noDocker
      );
      choices.demo = await ask(
         rl,
         "Start a demo bucket to browse? (runs MinIO in Docker)",
         false
      );
      choices.landing = await ask(
         rl,
         "Run the marketing landing site too?",
         false
      );
      return choices;
   } finally {
      rl.close();
   }
}

function backup(path) {
   const target = `${path}.bak-${Date.now()}`;
   copyFileSync(path, target);
   process.stdout.write(`  backed up ${path} → ${target}\n`);
   return target;
}

// scripts/dev.mjs starts the landing site whenever this file exists, so a
// re-run that answers "no" has to take it away rather than leave a stale one.
export function removeStaleLanding(path = landingEnvPath) {
   if (!existsSync(path)) return null;
   const target = backup(path);
   rmSync(path);
   process.stdout.write(
      `✓ Removed ${path} — the landing site wasn't selected, so \`pnpm dev\` won't start it\n`
   );
   return target;
}

function writeEnvFiles(choices) {
   const secrets = generateSecrets();
   const write = (path, content) => {
      if (existsSync(path)) backup(path);
      writeFileSync(path, content);
      process.stdout.write(`✓ Wrote ${path}\n`);
   };
   const example = (path) => readFileSync(`${path}.example`, "utf8");
   write(apiEnvPath, buildApiEnv(example(apiEnvPath), choices, secrets));
   write(webEnvPath, buildWebEnv(example(webEnvPath), choices));
   if (choices.landing) {
      write(landingEnvPath, buildLandingEnv(example(landingEnvPath)));
   } else {
      removeStaleLanding();
   }
}

function summarize(env) {
   const profiles = env.COMPOSE_PROFILES ?? "";
   return {
      email: profiles.includes("email"),
      demo: profiles.includes("demo"),
      landing: existsSync(landingEnvPath),
   };
}

function printDone(summary) {
   const lines = [
      "",
      "✓ Setup complete.",
      "",
      `  web       ${SITE_URL}`,
      `  api       ${API_URL}`,
   ];
   if (summary.landing) lines.push(`  landing   ${LANDING_URL}`);
   if (summary.email) lines.push(`  inbox     ${MAILPIT_URL}  (mailpit)`);
   if (summary.demo) {
      lines.push(
         `  MinIO     ${MINIO_CONSOLE}  (console)`,
         `            ${MINIO_ENDPOINT}  (endpoint to connect from S3 Viewer)`,
         `            ${MINIO_CREDENTIALS}  (access key / secret key)`,
         `            bucket "${DEMO_BUCKET}"`
      );
   }
   lines.push("", "Start everything with: pnpm dev", "");
   process.stdout.write(lines.join("\n"));
}

async function migrate(env) {
   process.stdout.write("\nApplying database migrations...\n");
   runPrisma("deploy", { DATABASE_URL: env.DATABASE_URL });
}

export async function runSetup(argv = process.argv.slice(2)) {
   const flags = new Set(argv);
   const noDocker = flags.has("--no-docker");
   const interactive =
      !flags.has("--yes") && Boolean(process.stdin.isTTY) && !process.env.CI;

   // apps/api/.env is the file that carries the secrets: without it there is
   // nothing to keep, whatever the other apps happen to have lying around.
   if (existsSync(apiEnvPath)) {
      let regenerate = false;
      if (interactive) {
         const existing = [apiEnvPath, webEnvPath, landingEnvPath].filter(
            existsSync
         );
         const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
         });
         try {
            process.stdout.write(
               `\nFound existing env files:\n${existing.map((path) => `  ${path}`).join("\n")}\n`
            );
            regenerate = !(await ask(
               rl,
               "Keep them and just start services + migrate?",
               true
            ));
         } finally {
            rl.close();
         }
      }
      if (!regenerate) {
         const env = parseEnvFile(apiEnvPath);
         if (!(await ensureDevInfra(env))) process.exit(1);
         await migrate(env);
         printDone(summarize(env));
         return;
      }
   }

   const choices = await collectChoices({ interactive, noDocker });
   process.stdout.write(
      "\nGenerating secrets (4096-bit RSA, this takes a moment)...\n"
   );
   writeEnvFiles(choices);

   const env = parseEnvFile(apiEnvPath);
   if (!(await ensureDevInfra(env))) process.exit(1);
   await migrate(env);
   printDone(summarize(env));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
   runSetup().catch((error) => {
      process.stderr.write(
         `\n✗ ${error instanceof Error ? error.message : String(error)}\n\n`
      );
      process.exit(1);
   });
}
