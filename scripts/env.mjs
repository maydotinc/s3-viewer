import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const composeFile = join(root, "docker-compose.dev.yml");
export const apiEnvPath = join(root, "apps", "api", ".env");
export const webEnvPath = join(root, "apps", "web", ".env");
export const landingEnvPath = join(root, "apps", "landing", ".env");

const VALUE = `"(?:[^"\\\\]|\\\\[\\s\\S])*"|'(?:[^'\\\\]|\\\\[\\s\\S])*'`;
const ENTRY = new RegExp(
   `^[ \\t]*(?:export[ \\t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \\t]*=[ \\t]*(${VALUE}|[^#\\r\\n]*)`,
   "gm"
);

// Quoted values may span lines, so the whole assignment is consumed as one
// match: the base64 body of a PEM never gets mistaken for further keys.
export function parseEnv(content) {
   const env = {};
   for (const [, key, raw] of content.matchAll(ENTRY)) env[key] = unquote(raw);
   return env;
}

export function parseEnvFile(path) {
   if (!existsSync(path)) return null;
   return parseEnv(readFileSync(path, "utf8"));
}

function unquote(raw) {
   const value = raw.trim();
   const quote = value[0];
   if (
      value.length > 1 &&
      (quote === '"' || quote === "'") &&
      value.endsWith(quote)
   ) {
      const inner = value.slice(1, -1);
      if (quote === "'") return inner;
      return inner
         .replace(/\\n/g, "\n")
         .replace(/\\r/g, "\r")
         .replace(/\\(["\\])/g, "$1");
   }
   return value;
}

// dotenv (what apps/api actually reads its .env with) has no escapes inside
// quotes and expands \n in double-quoted values, so only the three forms it
// reads back verbatim are emitted — anything else would be silently mangled.
const BARE = /^[A-Za-z0-9_./:@+=,-]+$/;

function formatValue(key, value) {
   const text = String(value);
   if (text === "" || BARE.test(text)) return text;
   if (!text.includes("'")) return `'${text}'`;
   if (!text.includes('"') && !text.includes("\\")) return `"${text}"`;
   throw new Error(
      `${key} can't be written to a .env file: its value mixes a single quote with a double quote or a backslash, which .env quoting cannot represent. Change the value, or set ${key} in the file by hand.`
   );
}

const escapeRegExp = (text) => text.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");

export function setKey(content, key, value, comment) {
   const line = `${key}=${formatValue(key, value)}`;
   const existing = new RegExp(
      `^[ \\t]*(?:export[ \\t]+)?${escapeRegExp(key)}[ \\t]*=[ \\t]*(?:${VALUE}|[^\\r\\n]*)`,
      "m"
   );
   if (existing.test(content)) return content.replace(existing, () => line);
   const block = comment ? `# ${comment}\n${line}` : line;
   return `${content.trimEnd()}\n\n${block}\n`;
}

// Values already in the real environment win: a contributor exporting
// DATABASE_URL for one command shouldn't be silently overridden by a file.
export function loadEnv(path, target = process.env) {
   const env = parseEnvFile(path);
   if (!env) return null;
   for (const [key, value] of Object.entries(env)) {
      if (target[key] === undefined) target[key] = value;
   }
   return env;
}

export function must(command, args, extraEnv = {}) {
   const result = spawnSync(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
   });
   if (result.status !== 0) {
      process.stderr.write(
         `\n✗ \`${command} ${args.join(" ")}\` failed (exit ${String(result.status)}).\n`
      );
      process.exit(result.status ?? 1);
   }
}

// An empty host is meaningful: `postgresql:///db?host=/var/run/postgresql`
// connects over a unix socket, so there is nothing to reach over TCP.
export function hostPortOf(url, fallbackPort) {
   try {
      const parsed = new URL(url);
      return {
         host: parsed.hostname,
         port: Number(parsed.port) || fallbackPort,
      };
   } catch {
      return { host: "localhost", port: fallbackPort };
   }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Only a database this checkout is responsible for is worth blocking on: the
// docker one we just started, or one on this machine.
export function shouldWaitForPostgres(host, managed) {
   if (!host) return false;
   return managed || LOCAL_HOSTS.has(host);
}

export function tcpCheck(host, port, timeoutMs = 1500) {
   return new Promise((resolve) => {
      const socket = createConnection({ host, port });
      const done = (ok) => {
         socket.destroy();
         resolve(ok);
      };
      socket.setTimeout(timeoutMs, () => done(false));
      socket.on("connect", () => done(true));
      socket.on("error", () => done(false));
   });
}

export async function waitForTcp(label, host, port, timeoutMs = 60000) {
   const deadline = Date.now() + timeoutMs;
   while (Date.now() < deadline) {
      if (await tcpCheck(host, port)) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
   }
   process.stderr.write(
      `✗ ${label} did not become reachable on ${host}:${String(port)} within ${String(timeoutMs / 1000)}s.\n`
   );
   return false;
}

// Starts the docker-compose.dev.yml services selected by COMPOSE_PROFILES, then
// waits for Postgres to accept connections so migrate/dev don't race the
// container. No profiles means the contributor runs their own database.
export async function ensureDevInfra(env, { quiet = false } = {}) {
   const profiles = env.COMPOSE_PROFILES ?? "";
   if (profiles.length > 0) {
      if (!quiet)
         process.stdout.write(`Starting docker services (${profiles})...\n`);
      const result = spawnSync(
         "docker",
         ["compose", "-f", composeFile, "up", "-d"],
         {
            cwd: root,
            stdio: quiet ? "ignore" : "inherit",
            env: { ...process.env, COMPOSE_PROFILES: profiles },
            shell: process.platform === "win32",
         }
      );
      if (result.status !== 0) {
         process.stderr.write(
            "\n✗ `docker compose up -d` failed. Is Docker running? Start it and try again, or\n" +
               "  re-run `pnpm run setup --no-docker` and point DATABASE_URL at your own Postgres.\n"
         );
         return false;
      }
   }
   const pg = hostPortOf(env.DATABASE_URL ?? "", 5432);
   const managed = profiles.includes("core");
   if (!shouldWaitForPostgres(pg.host, managed)) return true;
   if (await waitForTcp("Postgres", pg.host, pg.port, managed ? 60000 : 5000))
      return true;
   process.stderr.write(
      managed
         ? `\n✗ Postgres isn't reachable. Check \`docker compose -f ${composeFile} ps\` and its logs.\n`
         : "\n✗ Postgres isn't reachable. DATABASE_URL points at a database you manage —\n" +
              "  start it, or re-run `pnpm run setup` and let Docker manage it.\n"
   );
   return false;
}
