import { request } from "node:http";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testServers } from "@/lib/testing/test-server";

const reached = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/config", () => ({ publicConfig: () => ({}) }));
vi.mock("@s3-viewer/auth", () => ({
   signUpPolicy: { mode: "open", allowedEmailDomains: [] },
   auth: {
      api: {},
      handler: async (incoming: Request) => {
         const { pathname } = new URL(incoming.url);
         reached.push(pathname);
         return Response.json({ pathname });
      },
   },
}));

const serve = testServers("suite");
let port = 0;

beforeAll(async () => {
   const { createApp } = await import("./app");
   ({ port } = await serve(createApp()));
});

// fetch normalizes dot segments client-side, so send the raw request target.
const rawPost = (path: string) =>
   new Promise<{ status: number; policy: string | undefined }>(
      (resolve, reject) => {
         const outgoing = request(
            {
               agent: false,
               host: "127.0.0.1",
               port,
               method: "POST",
               path,
               headers: {
                  origin: "http://localhost:3000",
                  "content-type": "application/json",
               },
            },
            (response) => {
               response.resume();
               response.on("end", () =>
                  resolve({
                     status: response.statusCode ?? 0,
                     policy: response.headers["ratelimit-policy"] as
                        | string
                        | undefined,
                  })
               );
            }
         );
         outgoing.on("error", reject);
         outgoing.end(JSON.stringify({ email: "a@example.com" }));
      }
   );

describe("non-canonical auth paths", () => {
   it.each([
      "/auth/./sign-up/email",
      "/auth/%2e/sign-up/email",
      "/auth/x/../sign-up/email",
      "/auth/sign-up/./email",
      "/auth//sign-up/email",
   ])("refuses %s before Better Auth sees it", async (path) => {
      reached.length = 0;
      expect((await rawPost(path)).status).toBe(400);
      expect(reached).toEqual([]);
   });

   it("still serves the canonical sign-up path through the sign-up limiter", async () => {
      reached.length = 0;
      const response = await rawPost("/auth/sign-up/email");
      expect(response.status).toBe(200);
      expect(response.policy).toBe("10;w=3600");
      expect(reached).toEqual(["/auth/sign-up/email"]);
   });
});

describe("response caching headers", () => {
   it("sends no ETag on JSON responses", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get("etag")).toBeNull();
   });

   it("marks every response private and uncacheable unless a route says otherwise", async () => {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(health.headers.get("cache-control")).toBe("private, no-store");
      const config = await fetch(`http://127.0.0.1:${port}/config`, {
         headers: { origin: "http://localhost:3000" },
      });
      expect(config.status).toBe(200);
      expect(config.headers.get("cache-control")).toBe("public, max-age=60");
   });

   it("lets browsers cache CORS preflights for ten minutes", async () => {
      const response = await fetch(`http://127.0.0.1:${port}/servers`, {
         method: "OPTIONS",
         headers: {
            origin: "http://localhost:3000",
            "access-control-request-method": "PATCH",
         },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-max-age")).toBe("600");
   });
});
