import { spawnSync } from "node:child_process";
import { sep } from "node:path";
import {
   ALL_PROFILES,
   apiEnvPath,
   isMain,
   isWindows,
   parseEnvFile,
   root,
   runCompose,
} from "./env.mjs";
import {
   ownedProcessChain,
   parseWindowsListeners,
   readDevOwners,
   stopWindowsProcess,
   windowsProcesses,
} from "./dev-processes.mjs";

const PORTS = { web: 3000, landing: 3001, api: 5001 };

function listenersOn(port) {
   if (isWindows()) {
      const out = spawnSync("netstat", ["-ano", "-p", "TCP"], {
         encoding: "utf8",
      });
      if (out.status !== 0) return [];
      return parseWindowsListeners(out.stdout, port);
   }
   const out = spawnSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      {
         encoding: "utf8",
      }
   );
   if (out.status !== 0) return [];
   return [...new Set(out.stdout.split("\n").map(Number).filter(Boolean))];
}

function cwdOf(pid) {
   const out = spawnSync(
      "lsof",
      ["-a", "-d", "cwd", "-p", String(pid), "-Fn"],
      {
         encoding: "utf8",
      }
   );
   if (out.status !== 0) return null;
   const line = out.stdout.split("\n").find((entry) => entry.startsWith("n"));
   return line ? line.slice(1) : null;
}

function ownedByCheckout(cwd, repoRoot = root) {
   if (!cwd || !repoRoot) return false;
   const base = repoRoot.endsWith(sep) ? repoRoot : `${repoRoot}${sep}`;
   return cwd === repoRoot || cwd.startsWith(base);
}

function kill(pid) {
   try {
      process.kill(pid, "SIGTERM");
      return true;
   } catch {
      return false;
   }
}

function stopDevServers() {
   const windows = isWindows();
   if (
      !windows &&
      spawnSync("lsof", ["-v"], { stdio: "ignore" }).error?.code === "ENOENT"
   ) {
      process.stderr.write(
         "lsof isn't installed, so running dev servers can't be found. Install lsof or stop them yourself.\n"
      );
      return;
   }
   const owners = windows ? readDevOwners() : [];
   let processes;
   let stopped = 0;
   for (const [name, port] of Object.entries(PORTS)) {
      for (const pid of listenersOn(port)) {
         if (windows) processes ??= windowsProcesses();
         const chain = owners
            .map((owner) => ownedProcessChain(processes ?? [], pid, owner))
            .find(Boolean);
         const cwd = windows ? null : cwdOf(pid);
         if (windows ? !chain : !ownedByCheckout(cwd)) {
            process.stdout.write(
               `left :${String(port)} alone — owned by ${cwd ?? "a process outside this checkout"}\n`
            );
            continue;
         }
         if (windows ? stopWindowsProcess(chain) : kill(pid)) {
            process.stdout.write(
               `Stopped ${name} on :${String(port)} (pid ${String(pid)}).\n`
            );
            stopped += 1;
         }
      }
   }
   if (stopped === 0)
      process.stdout.write("No owned dev servers were stopped.\n");
}

export function composeStopOutcome(result, { dockerless = false } = {}) {
   // a signal means docker ran and was killed mid-stop, so the services may still be up.
   if (result.signal) {
      return {
         code: 1,
         message: `\n❌ docker compose was killed by ${result.signal} before it finished stopping the services. Dev servers were still stopped.\n`,
      };
   }
   // no status at all means the docker binary never ran (missing, or spawn failed).
   if (result.error || result.status === null) {
      return {
         code: 0,
         message: dockerless
            ? null
            : "Docker isn't available, so there are no docker services to stop.\n",
      };
   }
   if (result.status !== 0 && !dockerless) {
      return {
         code: result.status,
         message:
            "\n❌ Couldn't stop the docker services (is Docker running?). Dev servers were still stopped.\n",
      };
   }
   return { code: 0, message: null };
}

function main() {
   const flags = new Set(process.argv.slice(2));
   stopDevServers();

   const env = parseEnvFile(apiEnvPath);
   if (!env) {
      process.stdout.write(
         "No docker services to stop: apps/api/.env doesn't exist yet (`pnpm run setup` creates it).\n"
      );
      return;
   }
   // an empty or missing COMPOSE_PROFILES means nothing in Docker, so this must work without Docker installed.
   const dockerless = !env.COMPOSE_PROFILES;
   const args = flags.has("--down")
      ? ["down", ...(flags.has("--volumes") ? ["--volumes"] : [])]
      : ["stop"];
   const result = runCompose(args, {
      env: { ...process.env, COMPOSE_PROFILES: ALL_PROFILES },
      ...(dockerless ? { stdio: "ignore" } : {}),
   });
   const outcome = composeStopOutcome(result, { dockerless });
   if (outcome.message)
      (outcome.code === 0 ? process.stdout : process.stderr).write(
         outcome.message
      );
   if (outcome.code !== 0) process.exit(outcome.code);
}

if (isMain(import.meta.url)) {
   main();
}
