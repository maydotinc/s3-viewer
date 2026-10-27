import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// realpath so `pnpm stop` can match the cwd lsof reports for a symlinked checkout.
export const root = realpathSync(
   join(dirname(fileURLToPath(import.meta.url)), "..")
);
export const composeFile = join(root, "docker-compose.dev.yml");
export const apiEnvPath = join(root, "apps", "api", ".env");
export const webEnvPath = join(root, "apps", "web", ".env");
export const landingEnvPath = join(root, "apps", "landing", ".env");

export const ALL_PROFILES = "core,email,demo";

export function parseProfiles(raw = "") {
   return new Set(
      raw
         .split(",")
         .map((name) => name.trim())
         .filter(Boolean)
   );
}

// re-read on each call so tests can switch process.platform.
export const isWindows = () => process.platform === "win32";
const dockerBinary = () => (isWindows() ? "docker.exe" : "docker");

export function isMain(moduleUrl) {
   try {
      return realpathSync(process.argv[1]) === fileURLToPath(moduleUrl);
   } catch {
      return false;
   }
}

const LABEL_WIDTH = 9;
export const DETAIL_INDENT = " ".repeat(6 + LABEL_WIDTH);
export const detail = (emoji, label, value) =>
   `   ${emoji} ${label.padEnd(LABEL_WIDTH)}${value}`;

const VALUE = `"(?:[^"\\\\]|\\\\[\\s\\S])*"|'(?:[^'\\\\]|\\\\[\\s\\S])*'`;
const ENTRY = new RegExp(
   `^[ \\t]*(?:export[ \\t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \\t]*=[ \\t]*(${VALUE}|[^#\\r\\n]*)`,
   "gm"
);

// quoted values may span lines, so a PEM's base64 body is never read as further keys.
function parseEnv(content) {
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

// dotenv has no escapes in quotes and expands \n in double quotes, so emit only verbatim forms.
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
      shell: isWindows(),
   });
   if (result.status !== 0) {
      process.stderr.write(
         `\n❌ \`${command} ${args.join(" ")}\` failed (exit ${String(result.status)}).\n`
      );
      process.exit(result.status ?? 1);
   }
}

// net can't resolve IPv6 brackets, so strip them.
function hostPortOf(url, fallbackPort) {
   try {
      const parsed = new URL(url);
      return {
         host: parsed.hostname.replace(/^\[|\]$/g, ""),
         port: Number(parsed.port) || fallbackPort,
      };
   } catch {
      return { host: "localhost", port: fallbackPort };
   }
}

export const DEFAULT_POSTGRES_PORT = 5432;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function shouldWaitForPostgres(host, managed) {
   // an empty host is a unix socket: nothing to reach over TCP.
   if (!host) return false;
   return managed || LOCAL_HOSTS.has(host);
}

function tcpCheck(host, port, timeoutMs = 1500) {
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

async function waitForTcp(label, host, port, timeoutMs = 60000) {
   const deadline = Date.now() + timeoutMs;
   while (Date.now() < deadline) {
      if (await tcpCheck(host, port)) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
   }
   process.stderr.write(
      `❌ ${label} did not become reachable on ${host}:${String(port)} within ${String(timeoutMs / 1000)}s.\n`
   );
   return false;
}

export function runCompose(args, options = {}) {
   return spawnSync(dockerBinary(), ["compose", "-f", composeFile, ...args], {
      cwd: root,
      stdio: "inherit",
      ...options,
      shell: false,
   });
}

const SERVICE_PORTS = [
   {
      profile: "email",
      service: "mailpit",
      label: "the local email inbox",
      ports: [8025, 1025],
   },
   {
      profile: "demo",
      service: "rustfs",
      label: "the demo bucket",
      ports: [9000, 9001],
   },
];

function neededPorts(enabled, postgresPort) {
   return [
      ...(enabled.has("core")
         ? [{ service: "postgres", label: "Postgres", ports: [postgresPort] }]
         : []),
      ...SERVICE_PORTS.filter(({ profile }) => enabled.has(profile)),
   ];
}

function dockerRunning() {
   return (
      spawnSync(dockerBinary(), ["info"], { stdio: "ignore", shell: false })
         .status === 0
   );
}

function runningServices(env = process.env) {
   const result = runCompose(["ps", "--status", "running", "--services"], {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      env,
   });
   if (result.status !== 0) return new Set();
   return new Set(
      String(result.stdout ?? "")
         .split("\n")
         .map((name) => name.trim())
         .filter(Boolean)
   );
}

export async function portConflicts(needed, running) {
   const conflicts = [];
   for (const need of needed) {
      if (running.has(need.service)) continue;
      const busy = [];
      for (const port of need.ports) {
         if (await tcpCheck("127.0.0.1", port, 500)) busy.push(port);
      }
      if (busy.length > 0) conflicts.push({ ...need, ports: busy });
   }
   return conflicts;
}

function conflictMessage({ service, label, ports }) {
   const which =
      ports.length === 1
         ? `Port ${String(ports[0])} is`
         : `Ports ${ports.join(" and ")} are`;
   const lines = [
      `❌ ${which} already in use on this machine, so Docker can't start ${label}.`,
      `   To see what's using it: lsof -nP -iTCP:${String(ports[0])} -sTCP:LISTEN`,
   ];
   if (service === "postgres") {
      lines.push(
         "   This is usually a Postgres you installed yourself (Homebrew, Postgres.app).",
         "   Run `pnpm run setup` and it will move Docker's Postgres to a free port,",
         "   or stop yours (`brew services list` shows the Homebrew one)."
      );
   } else {
      lines.push(
         `   Stop it, or run \`pnpm run setup\` again and turn off ${label}.`
      );
   }
   return `\n${lines.join("\n")}\n`;
}

export const postgresPortOf = (url) =>
   hostPortOf(url ?? "", DEFAULT_POSTGRES_PORT).port;

export async function pickPostgresPort(existingUrl) {
   const current = postgresPortOf(existingUrl);
   if (runningServices().has("postgres")) return current;
   if (!(await tcpCheck("127.0.0.1", current, 500))) return current;
   for (
      let port = DEFAULT_POSTGRES_PORT;
      port < DEFAULT_POSTGRES_PORT + 10;
      port++
   ) {
      if (!(await tcpCheck("127.0.0.1", port, 500))) return port;
   }
   return DEFAULT_POSTGRES_PORT;
}

export async function ensureDevInfra(env, { quiet = false } = {}) {
   const profiles = env.COMPOSE_PROFILES ?? "";
   const enabled = parseProfiles(profiles);
   const pg = hostPortOf(env.DATABASE_URL ?? "", DEFAULT_POSTGRES_PORT);
   if (profiles.length > 0) {
      const composeEnv = {
         ...process.env,
         COMPOSE_PROFILES: profiles,
         POSTGRES_PORT: String(pg.port),
      };
      if (!dockerRunning()) {
         process.stderr.write(
            "\n❌ Docker isn't running. Start Docker Desktop (or the Docker daemon) and try\n" +
               "   again, or re-run `pnpm run setup --no-docker` and point DATABASE_URL at your\n" +
               "   own Postgres.\n"
         );
         return false;
      }
      const conflicts = await portConflicts(
         neededPorts(enabled, pg.port),
         runningServices(composeEnv)
      );
      if (conflicts.length > 0) {
         process.stderr.write(conflicts.map(conflictMessage).join(""));
         return false;
      }
      if (!quiet)
         process.stdout.write(`🐳 Starting docker services (${profiles})...\n`);
      const up = (args) =>
         runCompose(args, {
            stdio: quiet ? ["ignore", "ignore", "pipe"] : "inherit",
            encoding: "utf8",
            env: composeEnv,
         });
      let result = up(["up", "-d"]);
      if (result.status === 0 && enabled.has("core")) {
         result = up(["up", "-d", "--wait", "postgres"]);
      }
      if (result.status !== 0) {
         if (result.stderr) process.stderr.write(`\n${String(result.stderr)}`);
         process.stderr.write(
            "\n❌ Docker couldn't start the dev services; its error is above. Fix that and\n" +
               "   try again, or re-run `pnpm run setup --no-docker` and point DATABASE_URL at\n" +
               "   your own Postgres.\n"
         );
         return false;
      }
   }
   const managed = enabled.has("core");
   if (!shouldWaitForPostgres(pg.host, managed)) return true;
   if (await waitForTcp("Postgres", pg.host, pg.port, managed ? 60000 : 5000))
      return true;
   process.stderr.write(
      managed
         ? `\n❌ Postgres isn't reachable. Check \`docker compose -f ${composeFile} ps\` and its logs.\n`
         : "\n❌ Postgres isn't reachable. DATABASE_URL points at a database you manage —\n" +
              "  start it, or re-run `pnpm run setup` and let Docker manage it.\n"
   );
   return false;
}
