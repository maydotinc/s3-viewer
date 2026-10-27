import express, {
   type Express,
   type Request,
   type RequestHandler,
} from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll } from "vitest";
import { authorizeScopeRows, type DbRole } from "./scope-probe";
import { closeServer, listen } from "./test-server";

type TestUser = NonNullable<Request["user"]>;

const testUser = (overrides: Partial<TestUser> = {}): TestUser => ({
   id: "actor12345",
   email: "actor@example.com",
   emailVerified: true,
   name: "Actor",
   createdAt: new Date(),
   updatedAt: new Date(),
   ...overrides,
});

// signs each request in as a verified user; `user` runs per request so a test can switch actors.
const signedIn =
   (user: () => Partial<TestUser> | null = () => ({})): RequestHandler =>
   (req, _res, next) => {
      const overrides = user();
      if (overrides) req.user = testUser(overrides);
      next();
   };

type RouteServer = { readonly origin: string };

const routeServer = (
   build: (app: Express) => void,
   ready: (origin: string) => void = () => undefined
): RouteServer => {
   let server: Server | undefined;
   let origin = "";
   beforeAll(async () => {
      const app = express();
      build(app);
      ({ server, origin } = await listen(app));
      ready(origin);
   });
   afterAll(async () => {
      if (server) await closeServer(server);
   });
   return {
      get origin() {
         return origin;
      },
   };
};

type ScopeLookup = Parameters<typeof authorizeScopeRows>[2];
type RawQuery = (
   strings: TemplateStringsArray,
   ...values: unknown[]
) => Promise<unknown>;

// a prisma.$queryRaw stand-in: authorization probes are answered from `lookup`,
// anything else goes to `otherwise` or fails the test.
const scopeQueryRaw =
   (lookup: ScopeLookup, otherwise?: RawQuery): RawQuery =>
   async (strings, ...values) => {
      const rows = authorizeScopeRows(strings, values, lookup);
      if (rows) return rows;
      if (otherwise) return otherwise(strings, ...values);
      throw new Error("unexpected raw query in these tests");
   };

const bucketMember = (role: DbRole | null, buckets: string[] = ["backups"]) =>
   role
      ? {
           role,
           allowedBuckets: buckets,
           restrictedBuckets: true,
           grants: buckets.map((bucketName) => ({ bucketName, role })),
        }
      : null;

const poolTimeout = (): Error =>
   Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { name: "PrismaClientKnownRequestError", code: "P2024" }
   );

export { bucketMember, poolTimeout, routeServer, scopeQueryRaw, signedIn };
