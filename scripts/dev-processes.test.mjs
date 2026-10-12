import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync }));
const {
   ownedProcessChain,
   parseWindowsListeners,
   stopWindowsProcess,
   windowsProcesses,
   readDevOwners,
   registerDevProcess,
} = await import("./dev-processes.mjs");

beforeEach(() => spawnSync.mockReset());

const owner = { pid: 10, created: "2026-09-19T12:00:00.0000000Z" };
const child = {
   pid: 20,
   parentPid: 10,
   created: "2026-09-19T12:00:01.0000000Z",
};
const listener = {
   pid: 30,
   parentPid: 20,
   created: "2026-09-19T12:00:02.0000000Z",
};

describe("Windows listener ownership", () => {
   it("matches only exact TCP listening local ports for IPv4 and IPv6", () => {
      const output = [
         "  TCP    127.0.0.1:3000    0.0.0.0:0    LISTENING    30",
         "  TCP    [::1]:3000       [::]:0       LISTENING    31",
         "  TCP    127.0.0.1:30001   0.0.0.0:0    LISTENING    32",
         "  TCP    [::1]:50010      [::]:0       LISTENING    33",
         "  TCP    127.0.0.1:5001   0.0.0.0:0    LISTENING    34",
         "  TCP    127.0.0.1:5555   127.0.0.1:3000 ESTABLISHED 35",
         "  UDP    127.0.0.1:3000   *:*          LISTENING    36",
         "  TCP    [::]:3000       [::]:0       LISTENING    30",
         "  TCP    127.0.0.1:3000  0.0.0.0:0    LISTENING    invalid",
      ].join("\r\n");
      expect(parseWindowsListeners(output, 3000)).toEqual([30, 31]);
      expect(parseWindowsListeners(output, 5001)).toEqual([34]);
   });

   it("allows only a descendant of this checkout's recorded launcher", () => {
      expect(ownedProcessChain([owner, child, listener], 30, owner)).toEqual([
         { pid: 30, created: listener.created },
         { pid: 20, created: child.created },
         owner,
      ]);
   });

   it.each([
      ["untracked launcher", [owner, child, listener], null],
      [
         "unrelated same-port listener",
         [owner, { ...listener, parentPid: 99 }],
         owner,
      ],
      [
         "reused launcher PID",
         [{ ...owner, created: child.created }, child, listener],
         owner,
      ],
      [
         "reused intermediate PID",
         [
            owner,
            { ...child, created: "2026-09-19T12:00:03.0000000Z" },
            listener,
         ],
         owner,
      ],
      [
         "an intermediate PID reused within the same millisecond",
         [
            owner,
            { ...child, created: "2026-09-19T12:00:02.0000001Z" },
            listener,
         ],
         owner,
      ],
      [
         "missing process metadata",
         [owner, { ...listener, created: null }],
         owner,
      ],
      [
         "cyclic parent metadata",
         [owner, { ...listener, parentPid: 30 }],
         owner,
      ],
   ])("leaves %s alone", (_name, processes, recorded) => {
      expect(ownedProcessChain(processes, 30, recorded)).toBeNull();
   });

   it("does not terminate a process when ownership could not be established", () => {
      expect(stopWindowsProcess(null)).toBe(false);
      expect(spawnSync).not.toHaveBeenCalled();
   });

   it("passes revalidated creation identities to PowerShell without a shell", () => {
      spawnSync.mockReturnValue({ status: 1 });
      const chain = ownedProcessChain([owner, child, listener], 30, owner);
      expect(stopWindowsProcess(chain)).toBe(false);
      const [command, args, options] = spawnSync.mock.calls[0];
      expect(command).toBe("powershell.exe");
      expect(options).toMatchObject({ shell: false, timeout: 10_000 });
      const script = Buffer.from(args.at(-1), "base64").toString("utf16le");
      expect(script).toContain(
         Buffer.from(JSON.stringify({ chain })).toString("base64")
      );
      expect(script).toContain("$chain = $decoded.chain");
      expect(script.indexOf("$target.Handle")).toBeLessThan(
         script.indexOf("$target.Kill()")
      );
      expect(script).toContain(
         "CreationDate.ToUniversalTime().ToString('o') -cne $expected.created"
      );
   });

   it("fails closed when process inspection fails", () => {
      spawnSync.mockReturnValue({ status: 1, stdout: "" });
      expect(windowsProcesses()).toEqual([]);
      spawnSync.mockReturnValue({ status: 0, stdout: "not JSON" });
      expect(windowsProcesses()).toEqual([]);
   });
});

describe("launcher registration", () => {
   const originalPlatform = process.platform;
   const originalPid = process.pid;
   let directory;
   beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), "s3-viewer-launchers-"));
      Object.defineProperty(process, "platform", { value: "win32" });
   });
   afterEach(() => {
      Object.defineProperty(process, "platform", { value: originalPlatform });
      Object.defineProperty(process, "pid", { value: originalPid });
      vi.restoreAllMocks();
      rmSync(directory, { recursive: true, force: true });
   });
   it("retains the first launcher's identity when a second launch exits", () => {
      const second = { pid: 40, created: "2026-09-19T12:00:03.0000000Z" };
      spawnSync.mockReturnValue({
         status: 0,
         stdout: JSON.stringify([owner, second]),
      });
      const exits = [];
      vi.spyOn(process, "on").mockImplementation((event, callback) => {
         if (event === "exit") exits.push(callback);
         return process;
      });
      Object.defineProperty(process, "pid", { value: owner.pid });
      registerDevProcess(directory);
      Object.defineProperty(process, "pid", { value: second.pid });
      registerDevProcess(directory);
      expect(readDevOwners(directory)).toEqual([owner, second]);
      exits[1]();
      expect(readDevOwners(directory)).toEqual([owner]);
      expect(
         ownedProcessChain(
            [owner, child, listener],
            listener.pid,
            readDevOwners(directory)[0]
         )
      ).not.toBeNull();
      exits[0]();
      expect(readDevOwners(directory)).toEqual([]);
   });
   it("does not let an older exit callback remove a reused PID's identity", () => {
      const exits = [];
      vi.spyOn(process, "on").mockImplementation((event, callback) => {
         if (event === "exit") exits.push(callback);
         return process;
      });
      Object.defineProperty(process, "pid", { value: owner.pid });
      spawnSync.mockReturnValue({ status: 0, stdout: JSON.stringify([owner]) });
      registerDevProcess(directory);
      const replacement = { ...owner, created: listener.created };
      spawnSync.mockReturnValue({
         status: 0,
         stdout: JSON.stringify([replacement]),
      });
      registerDevProcess(directory);
      exits[0]();
      expect(readDevOwners(directory)).toEqual([replacement]);
   });
});
