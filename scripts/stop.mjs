import { spawnSync } from "node:child_process";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { apiEnvPath, composeFile, parseEnvFile, root } from "./env.mjs";

const PORTS = { web: 3000, landing: 3001, api: 5001 };
const ALL_PROFILES = "core,email,demo";

function listenersOn(port) {
   if (process.platform === "win32") {
      const out = spawnSync("netstat", ["-ano", "-p", "TCP"], {
         encoding: "utf8",
      });
      if (out.status !== 0) return [];
      return [
         ...new Set(
            out.stdout
               .split("\n")
               .filter(
                  (line) =>
                     line.includes(`:${port}`) && line.includes("LISTENING")
               )
               .map((line) => Number(line.trim().split(/\s+/).at(-1)))
               .filter((pid) => Number.isInteger(pid) && pid > 0)
         ),
      ];
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

// null when the cwd can't be resolved — an unknown process is never ours
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

export function ownedByCheckout(cwd, repoRoot = root) {
   if (!cwd || !repoRoot) return false;
   const base = repoRoot.endsWith(sep) ? repoRoot : `${repoRoot}${sep}`;
   return cwd === repoRoot || cwd.startsWith(base);
}

function kill(pid) {
   if (process.platform === "win32") {
      return (
         spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"]).status === 0
      );
   }
   try {
      process.kill(pid, "SIGTERM");
      return true;
   } catch {
      return false;
   }
}

function stopDevServers() {
   // Windows has no cheap way to read another process's cwd, so the guard only
   // applies where lsof does; everywhere else a port is left alone unless the
   // process listening on it lives in this checkout.
   const guarded = process.platform !== "win32";
   let stopped = 0;
   for (const [name, port] of Object.entries(PORTS)) {
      for (const pid of listenersOn(port)) {
         const cwd = guarded ? cwdOf(pid) : null;
         if (guarded && !ownedByCheckout(cwd)) {
            process.stdout.write(
               `left :${String(port)} alone — owned by ${cwd ?? "a process outside this checkout"}\n`
            );
            continue;
         }
         if (kill(pid)) {
            process.stdout.write(
               `Stopped ${name} on :${String(port)} (pid ${String(pid)}).\n`
            );
            stopped += 1;
         }
      }
   }
   if (stopped === 0) process.stdout.write("No dev servers were listening.\n");
}

function main() {
   const flags = new Set(process.argv.slice(2));
   stopDevServers();

   const profiles = parseEnvFile(apiEnvPath)?.COMPOSE_PROFILES || ALL_PROFILES;
   const args = flags.has("--down")
      ? ["down", ...(flags.has("--volumes") ? ["--volumes"] : [])]
      : ["stop"];
   const result = spawnSync("docker", ["compose", "-f", composeFile, ...args], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, COMPOSE_PROFILES: profiles },
      shell: process.platform === "win32",
   });
   if (result.status !== 0) {
      process.stderr.write(
         "\n❌ Couldn't stop the docker services (is Docker running?). Dev servers were still stopped.\n"
      );
      process.exit(result.status ?? 1);
   }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
   main();
}
