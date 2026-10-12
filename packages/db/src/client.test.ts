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

it("logs queries only when PRISMA_LOG_QUERIES is the exact string true", async () => {
   expect((await loadClient()).log).toEqual(["warn", "error"]);
   for (const value of ["", "TRUE", "1", "yes", "false"]) {
      process.env.PRISMA_LOG_QUERIES = value;
      expect((await loadClient()).log).toEqual(["warn", "error"]);
   }
   process.env.PRISMA_LOG_QUERIES = "true";
   expect((await loadClient()).log).toEqual(["query", "warn", "error"]);
});
