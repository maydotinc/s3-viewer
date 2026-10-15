import { createServer } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const spawnSync = vi.hoisted(() => vi.fn(() => ({ status: 0 })));
vi.mock("node:child_process", () => ({ spawnSync }));
const {
   composeFile,
   ensureDevInfra,
   parseProfiles,
   portConflicts,
   runCompose,
} = await import("./env.mjs");
const platform = process.platform;

afterEach(() => {
   Object.defineProperty(process, "platform", { value: platform });
   spawnSync.mockClear();
});

describe("compose execution", () => {
   it.each(["win32", "linux"])("preserves argument boundaries on %s", (os) => {
      Object.defineProperty(process, "platform", { value: os });
      const file = "C:\\Users\\First Last & Team\\compose.yml";
      runCompose(["-f", file, "up", "-d"], {
         env: { COMPOSE_PROFILES: "demo" },
      });
      expect(spawnSync).toHaveBeenCalledWith(
         os === "win32" ? "docker.exe" : "docker",
         ["compose", "-f", composeFile, "-f", file, "up", "-d"],
         expect.objectContaining({
            shell: false,
            env: { COMPOSE_PROFILES: "demo" },
         })
      );
   });
});

describe("compose profiles", () => {
   it("matches whole profile names, ignoring blanks and spacing", () => {
      expect([...parseProfiles(" core , demo,,")]).toEqual(["core", "demo"]);
      expect(parseProfiles("core-ui").has("core")).toBe(false);
      expect(parseProfiles(undefined).size).toBe(0);
   });
});

describe("postgres reachability", () => {
   it("waits on a bracketed IPv6 host", async (ctx) => {
      const server = createServer();
      const listening = await new Promise((resolve) => {
         server.once("error", () => resolve(false));
         server.listen(0, "::1", () => resolve(true));
      });
      if (!listening) ctx.skip("::1 is unavailable on this host");
      try {
         const { port } = server.address();
         await expect(
            ensureDevInfra(
               { DATABASE_URL: `postgresql://u:p@[::1]:${port}/db` },
               { quiet: true }
            )
         ).resolves.toBe(true);
      } finally {
         server.close();
      }
   });
});

const listen = async () => {
   const server = createServer();
   await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
   return { server, port: server.address().port };
};

describe("dev port conflicts", () => {
   it("reports a busy port unless our own service already holds it", async () => {
      const { server, port } = await listen();
      try {
         const needed = [
            { service: "postgres", label: "Postgres", ports: [port] },
         ];
         await expect(portConflicts(needed, new Set())).resolves.toEqual(
            needed
         );
         await expect(
            portConflicts(needed, new Set(["postgres"]))
         ).resolves.toEqual([]);
      } finally {
         server.close();
      }
   });

   it("stops before docker compose up when a port is taken", async () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const { server, port } = await listen();
      try {
         await expect(
            ensureDevInfra(
               {
                  COMPOSE_PROFILES: "core",
                  DATABASE_URL: `postgresql://u:p@localhost:${port}/db`,
               },
               { quiet: true }
            )
         ).resolves.toBe(false);
         expect(spawnSync).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.arrayContaining(["up"]),
            expect.anything()
         );
         expect(process.stderr.write).toHaveBeenCalledWith(
            expect.stringContaining(`Port ${port} is already in use`)
         );
      } finally {
         server.close();
         vi.restoreAllMocks();
      }
   });
});
