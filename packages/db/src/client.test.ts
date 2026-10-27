import { afterEach, expect, it, vi } from "vitest";

type ClientOptions = { log: string[] };

const constructed = vi.hoisted(() => [] as ClientOptions[]);

vi.mock("@prisma/client", () => ({
   PrismaClient: class {
      constructor(options: ClientOptions) {
         constructed.push(options);
      }
   },
}));

const loadClient = async (): Promise<ClientOptions> => {
   constructed.length = 0;
   globalThis.prisma = undefined;
   vi.resetModules();
   await import("./client");
   const [options] = constructed;
   if (!options) throw new Error("no prisma client was constructed");
   return options;
};

afterEach(() => {
   process.env.PRISMA_LOG_QUERIES = "";
   globalThis.prisma = undefined;
   vi.resetModules();
});

it("logs queries and raw prisma errors only when PRISMA_LOG_QUERIES is on", async () => {
   expect((await loadClient()).log).toEqual(["warn"]);
   for (const value of ["", "false", "0", "no", "off"]) {
      process.env.PRISMA_LOG_QUERIES = value;
      expect((await loadClient()).log).toEqual(["warn"]);
   }
   for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.PRISMA_LOG_QUERIES = value;
      expect((await loadClient()).log).toEqual(["query", "warn", "error"]);
   }
   process.env.PRISMA_LOG_QUERIES = "maybe";
   await expect(loadClient()).rejects.toThrow(/expected true or false/);
});
