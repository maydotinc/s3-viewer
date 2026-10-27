import { spawnSync } from "node:child_process";
import {
   mkdirSync,
   readdirSync,
   readFileSync,
   rmSync,
   writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { isWindows, root } from "./env.mjs";

const ownerDirectory = join(
   root,
   "node_modules",
   ".cache",
   "s3-viewer",
   "launchers"
);

export function parseWindowsListeners(output, port) {
   return [
      ...new Set(
         output.split(/\r?\n/).flatMap((line) => {
            const [protocol, local, , state, processId] = line
               .trim()
               .split(/\s+/);
            const pid = Number(processId);
            return protocol === "TCP" &&
               state === "LISTENING" &&
               Number(local?.match(/:(\d+)$/)?.[1]) === port &&
               Number.isSafeInteger(pid) &&
               pid > 0
               ? [pid]
               : [];
         })
      ),
   ];
}

const powershell = (script) =>
   spawnSync(
      "powershell.exe",
      [
         "-NoLogo",
         "-NoProfile",
         "-NonInteractive",
         "-EncodedCommand",
         Buffer.from(script, "utf16le").toString("base64"),
      ],
      { encoding: "utf8", windowsHide: true, shell: false, timeout: 10_000 }
   );

export function windowsProcesses() {
   const result = powershell(`$ErrorActionPreference = 'Stop'
Get-CimInstance Win32_Process | ForEach-Object {
   @{ pid = [int]$_.ProcessId; parentPid = [int]$_.ParentProcessId; created = $_.CreationDate.ToUniversalTime().ToString('o') }
} | ConvertTo-Json -Compress`);
   if (result.status !== 0) return [];
   try {
      const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
      return Array.isArray(parsed) ? parsed : [parsed];
   } catch {
      return [];
   }
}

const validIdentity = (identity) =>
   identity &&
   Number.isSafeInteger(identity.pid) &&
   identity.pid > 0 &&
   typeof identity.created === "string" &&
   /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(identity.created) &&
   Number.isFinite(Date.parse(identity.created));

export function ownedProcessChain(processes, pid, owner) {
   if (!validIdentity(owner)) return null;
   const indexed = new Map(processes.map((entry) => [entry.pid, entry]));
   const chain = [];
   const seen = new Set();
   let child;
   let current = indexed.get(pid);
   while (validIdentity(current) && !seen.has(current.pid)) {
      if (child && current.created > child.created) return null;
      seen.add(current.pid);
      chain.push({ pid: current.pid, created: current.created });
      if (current.pid === owner.pid)
         return current.created === owner.created ? chain : null;
      child = current;
      current = indexed.get(current.parentPid);
   }
   return null;
}

function readOwner(ownerFile) {
   try {
      const owner = JSON.parse(readFileSync(ownerFile, "utf8"));
      return validIdentity(owner) ? owner : null;
   } catch {
      return null;
   }
}

export function readDevOwners(directory = ownerDirectory) {
   try {
      return readdirSync(directory)
         .filter((name) => /^\d+\.json$/.test(name))
         .flatMap((name) => {
            const owner = readOwner(join(directory, name));
            return owner ? [owner] : [];
         });
   } catch {
      return [];
   }
}

export function registerDevProcess(directory = ownerDirectory) {
   if (!isWindows()) return;
   const owner = windowsProcesses().find(({ pid }) => pid === process.pid);
   if (!validIdentity(owner)) return;
   mkdirSync(directory, { recursive: true });
   const ownerFile = join(directory, `${owner.pid}.json`);
   writeFileSync(ownerFile, JSON.stringify(owner), { mode: 0o600 });
   process.on("exit", () => {
      const recorded = readOwner(ownerFile);
      if (recorded?.pid === owner.pid && recorded.created === owner.created)
         rmSync(ownerFile, { force: true });
   });
}

export function stopWindowsProcess(chain) {
   if (
      !Array.isArray(chain) ||
      chain.length === 0 ||
      !chain.every(validIdentity)
   )
      return false;
   const encoded = Buffer.from(JSON.stringify({ chain })).toString("base64");
   const result = powershell(`$ErrorActionPreference = 'Stop'
$decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
$chain = $decoded.chain
$target = [Diagnostics.Process]::GetProcessById([int]$chain[0].pid)
try {
   $null = $target.Handle
   for ($index = 0; $index -lt $chain.Count; $index++) {
      $expected = $chain[$index]
      $current = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$expected.pid)
      if (!$current -or $current.CreationDate.ToUniversalTime().ToString('o') -cne $expected.created) { exit 1 }
      if ($index + 1 -lt $chain.Count -and [int]$current.ParentProcessId -ne [int]$chain[$index + 1].pid) { exit 1 }
   }
   $target.Kill()
} finally {
   $target.Dispose()
}`);
   return result.status === 0;
}
