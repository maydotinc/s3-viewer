import {
   createPrivateKey,
   generateKeyPairSync,
   randomBytes,
} from "node:crypto";
import {
   chmodSync,
   copyFileSync,
   existsSync,
   readFileSync,
   rmSync,
   writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline/promises";
import { runPrisma } from "./db.mjs";
import {
   DEFAULT_POSTGRES_PORT,
   DETAIL_INDENT,
   apiEnvPath,
   detail,
   ensureDevInfra,
   isMain,
   landingEnvPath,
   parseEnvFile,
   parseProfiles,
   pickPostgresPort,
   postgresPortOf,
   setKey,
   webEnvPath,
} from "./env.mjs";

export const SITE_URL = "http://localhost:3000";
export const API_URL = "http://localhost:5001";
export const LANDING_URL = "http://localhost:3001";
const devDatabaseUrl = (port) =>
   `postgresql://s3viewer:s3viewer@localhost:${String(port)}/s3viewer`;
const HELP = `Usage: pnpm run setup [--yes] [--no-docker]

Writes apps/api/.env, apps/web/.env and, with the landing site, apps/landing/.env;
starts the Docker services you pick and applies database migrations. Run it again any time to change your choices.

  --yes        Accept every default without asking (also the default when
               stdin isn't a terminal or CI is set).
  --no-docker  Don't run anything in Docker. Needs DATABASE_URL set to your
               own Postgres, e.g.
               DATABASE_URL=postgresql://user:pass@localhost:5432/s3viewer
  -h, --help   Show this help.
`;
const FLAGS = new Set(["--yes", "--no-docker", "--help", "-h"]);
const SMTP_URL = "smtp://localhost:1025";
const MAILPIT_URL = "http://localhost:8025";
const DEMO_ENDPOINT = "http://localhost:9000";
const DEMO_CONSOLE = "http://localhost:9001/rustfs/console/";
const DEMO_CREDENTIALS = "rustfsadmin / rustfsadmin";
const DEMO_BUCKET = "demo";

const PROFILES_COMMENT =
   "Docker services the dev scripts manage for you (docker-compose.dev.yml).";

const PROFILES_LINE = /^[ \t]*(?:export[ \t]+)?COMPOSE_PROFILES[ \t]*=/;

export function clearComposeProfiles(content) {
   const kept = content
      .split("\n")
      .filter(
         (line) =>
            !PROFILES_LINE.test(line) &&
            line.trimEnd() !== `# ${PROFILES_COMMENT}`
      );
   return setKey(kept.join("\n"), "COMPOSE_PROFILES", "", PROFILES_COMMENT);
}

function usablePrivateKey(pem) {
   try {
      return Boolean(pem) && createPrivateKey(pem).asymmetricKeyType === "rsa";
   } catch {
      return false;
   }
}

// the API refuses to boot on a different encryption or audit key, so re-runs keep working ones.
export function resolveSecrets(existing) {
   if (
      (existing?.BETTER_AUTH_SECRET?.length ?? 0) >= 32 &&
      usablePrivateKey(existing.ENCRYPTION_PRIVATE_KEY)
   ) {
      process.stdout.write(
         "\n🔐 Keeping the secrets in apps/api/.env, which the existing database expects\n"
      );
      return {
         betterAuthSecret: existing.BETTER_AUTH_SECRET,
         encryptionPrivateKey: existing.ENCRYPTION_PRIVATE_KEY,
         auditChainKey: existing.AUDIT_CHAIN_KEY ?? "",
      };
   }
   process.stdout.write(
      "\n🔐 Generating secrets (4096-bit RSA, this takes a moment)...\n"
   );
   const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 4096 });
   return {
      betterAuthSecret: randomBytes(32).toString("base64"),
      encryptionPrivateKey: privateKey
         .export({ type: "pkcs8", format: "pem" })
         .trim(),
      auditChainKey: "",
   };
}

function composeProfiles(choices) {
   return [
      choices.docker ? "core" : null,
      choices.email ? "email" : null,
      choices.demo ? "demo" : null,
   ]
      .filter(Boolean)
      .join(",");
}

function buildApiEnv(example, choices, secrets) {
   let content = setKey(example, "DATABASE_URL", choices.databaseUrl);
   content = setKey(content, "BETTER_AUTH_SECRET", secrets.betterAuthSecret);
   content = setKey(
      content,
      "ENCRYPTION_PRIVATE_KEY",
      secrets.encryptionPrivateKey
   );
   content = setKey(content, "AUDIT_CHAIN_KEY", secrets.auditChainKey);
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

function buildWebEnv(example, choices) {
   let content = setKey(example, "NEXT_PUBLIC_SITE_URL", SITE_URL);
   content = setKey(content, "NEXT_PUBLIC_API_URL", API_URL);
   return setKey(content, "LANDING_ORIGIN", choices.landing ? LANDING_URL : "");
}

function buildLandingEnv(example) {
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

function databaseUrlQuestion(seeded) {
   return seeded
      ? `  Postgres connection string [${seeded}]: `
      : "  Postgres connection string: ";
}

function pickDatabaseUrl(answer, seeded) {
   return answer.trim() || seeded.trim();
}

async function withPrompt(fn) {
   const rl = createInterface({ input: process.stdin, output: process.stdout });
   try {
      return await fn(rl);
   } finally {
      rl.close();
   }
}

async function collectChoices({ interactive, noDocker }) {
   const seeded = noDocker ? (process.env.DATABASE_URL ?? "") : "";
   const defaults = {
      docker: !noDocker,
      databaseUrl: noDocker ? seeded : devDatabaseUrl(DEFAULT_POSTGRES_PORT),
      email: !noDocker,
      demo: false,
      landing: false,
   };
   if (!interactive) {
      if (!defaults.databaseUrl) {
         process.stderr.write(
            "\n❌ --no-docker needs a database: set DATABASE_URL in the environment and re-run.\n\n"
         );
         process.exit(1);
      }
      return defaults;
   }

   process.stdout.write(
      [
         "",
         "🪣 S3 Viewer setup",
         "",
         "Postgres is the only thing S3 Viewer can't run without — everything else",
         "is optional. Press Enter to accept the default in brackets.",
         "",
      ].join("\n")
   );

   return withPrompt(async (rl) => {
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
               "❌ S3 Viewer needs a database — nothing else to fall back to.\n"
            );
            process.exit(1);
         }
      }
      if (!noDocker) {
         choices.email = await ask(
            rl,
            "Catch outgoing email in a local inbox? (runs mailpit in Docker)",
            true
         );
         choices.demo = await ask(
            rl,
            "Start a demo bucket to browse? (runs RustFS in Docker)",
            false
         );
      }
      choices.landing = await ask(
         rl,
         "Run the marketing landing site too?",
         false
      );
      return choices;
   });
}

const OWNER_ONLY = 0o600;

function backup(path) {
   const target = `${path}.bak-${Date.now()}`;
   copyFileSync(path, target);
   chmodSync(target, OWNER_ONLY);
   process.stdout.write(`   backed up ${path} → ${target}\n`);
   return target;
}

// scripts/dev.mjs starts landing whenever this file exists, so answering "no" must remove it.
function removeStaleLanding(path = landingEnvPath) {
   if (!existsSync(path)) return null;
   const target = backup(path);
   rmSync(path);
   process.stdout.write(
      `✅ Removed ${path} — the landing site wasn't selected, so \`pnpm dev\` won't start it\n`
   );
   return target;
}

function writeEnvFiles(choices) {
   const secrets = resolveSecrets(parseEnvFile(apiEnvPath));
   const write = (path, content) => {
      if (existsSync(path)) backup(path);
      writeFileSync(path, content, { mode: OWNER_ONLY });
      chmodSync(path, OWNER_ONLY);
      process.stdout.write(`✅ Wrote ${path}\n`);
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
   const profiles = parseProfiles(env.COMPOSE_PROFILES);
   return {
      email: profiles.has("email"),
      demo: profiles.has("demo"),
      landing: existsSync(landingEnvPath),
   };
}

function printDone(summary) {
   const lines = [
      "",
      "✅ Setup complete.",
      "",
      detail("🌐", "web", SITE_URL),
      detail("🔌", "api", API_URL),
   ];
   if (summary.landing) lines.push(detail("🪧", "landing", LANDING_URL));
   if (summary.email) {
      lines.push(detail("📬", "inbox", `${MAILPIT_URL}  (mailpit)`));
   }
   if (summary.demo) {
      lines.push(
         detail("🪣", "RustFS", `${DEMO_CONSOLE}  (console)`),
         `${DETAIL_INDENT}${DEMO_ENDPOINT}  (endpoint to connect from S3 Viewer)`,
         `${DETAIL_INDENT}${DEMO_CREDENTIALS}  (access key / secret key)`,
         `${DETAIL_INDENT}bucket "${DEMO_BUCKET}"`
      );
   }
   lines.push("", "Start everything with: pnpm dev", "");
   process.stdout.write(lines.join("\n"));
}

function announcePort(current, port) {
   if (port === current) return;
   process.stdout.write(
      `\nℹ️  Port ${String(current)} is already taken on this machine (often a Postgres you\n` +
         `   installed yourself), so Docker's Postgres will use port ${String(port)} instead.\n`
   );
}

async function freePostgresPort(env) {
   if (!parseProfiles(env.COMPOSE_PROFILES).has("core")) return env;
   const current = postgresPortOf(env.DATABASE_URL);
   const port = await pickPostgresPort(env.DATABASE_URL);
   if (port === current) return env;
   announcePort(current, port);
   const url = new URL(env.DATABASE_URL);
   url.port = String(port);
   const databaseUrl = url.toString();
   writeFileSync(
      apiEnvPath,
      setKey(readFileSync(apiEnvPath, "utf8"), "DATABASE_URL", databaseUrl),
      { mode: OWNER_ONLY }
   );
   process.stdout.write(`✅ Updated DATABASE_URL in ${apiEnvPath}\n`);
   return { ...env, DATABASE_URL: databaseUrl };
}

async function finishSetup(env) {
   if (!(await ensureDevInfra(env))) process.exit(1);
   process.stdout.write("\n🗄️  Applying database migrations...\n");
   runPrisma("deploy", { DATABASE_URL: env.DATABASE_URL });
   printDone(summarize(env));
}

export async function runSetup(argv = process.argv.slice(2)) {
   const unknown = argv.filter((arg) => !FLAGS.has(arg));
   if (unknown.length > 0) {
      process.stderr.write(`Unknown option: ${unknown.join(" ")}\n\n${HELP}`);
      process.exit(1);
   }
   const flags = new Set(argv);
   if (flags.has("--help") || flags.has("-h")) {
      process.stdout.write(HELP);
      return;
   }
   const noDocker = flags.has("--no-docker");
   const interactive =
      !flags.has("--yes") && Boolean(process.stdin.isTTY) && !process.env.CI;

   if (existsSync(apiEnvPath)) {
      let regenerate = false;
      if (interactive) {
         const existing = [apiEnvPath, webEnvPath, landingEnvPath].filter(
            existsSync
         );
         process.stdout.write(
            `\nFound existing env files:\n${existing.map((path) => `   ${path}`).join("\n")}\n`
         );
         regenerate = !(await withPrompt((rl) =>
            ask(rl, "Keep them and just start services + migrate?", true)
         ));
      }
      if (!regenerate) {
         if (noDocker && parseEnvFile(apiEnvPath).COMPOSE_PROFILES !== "") {
            writeFileSync(
               apiEnvPath,
               clearComposeProfiles(readFileSync(apiEnvPath, "utf8")),
               { mode: OWNER_ONLY }
            );
            process.stdout.write(
               `✅ Cleared COMPOSE_PROFILES in ${apiEnvPath}\n`
            );
         }
         await finishSetup(await freePostgresPort(parseEnvFile(apiEnvPath)));
         return;
      }
   }

   const choices = await collectChoices({ interactive, noDocker });
   if (choices.docker) {
      const current = postgresPortOf(parseEnvFile(apiEnvPath)?.DATABASE_URL);
      const port = await pickPostgresPort(devDatabaseUrl(current));
      announcePort(current, port);
      choices.databaseUrl = devDatabaseUrl(port);
   }
   writeEnvFiles(choices);
   await finishSetup(parseEnvFile(apiEnvPath));
}

if (isMain(import.meta.url)) {
   runSetup().catch((error) => {
      process.stderr.write(
         `\n❌ ${error instanceof Error ? error.message : String(error)}\n\n`
      );
      process.exit(1);
   });
}
