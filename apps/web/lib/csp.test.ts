import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const load = async (
   env: Record<string, string>,
   options: { nonce?: string } = {}
) => {
   for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
   const { contentSecurityPolicy } = await import("./csp");
   const policy = contentSecurityPolicy(options);
   return Object.fromEntries(
      policy.split("; ").map((directive) => {
         const [name, ...values] = directive.split(" ");
         return [name, values.join(" ")];
      })
   );
};

beforeEach(() => {
   vi.resetModules();
   vi.stubEnv("NODE_ENV", "production");
   vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
   vi.stubEnv("LANDING_ORIGIN", "");
});

afterEach(() => {
   vi.unstubAllEnvs();
});

describe("remote schemes", () => {
   it("allows http: alongside https: when the install is served over http", async () => {
      const policy = await load({
         NEXT_PUBLIC_SITE_URL: "http://s3.lan:3000",
      });
      for (const directive of [
         "img-src",
         "media-src",
         "frame-src",
         "connect-src",
      ]) {
         expect(policy[directive]?.split(" ")).toContain("http:");
         expect(policy[directive]?.split(" ")).toContain("https:");
      }
      expect(policy["connect-src"]).toContain("https://api.example.com");
   });

   it.each(["https://s3.example.com", ""])(
      "keeps the install at site origin %j free of mixed content",
      async (siteUrl) => {
         const policy = await load({ NEXT_PUBLIC_SITE_URL: siteUrl });
         for (const directive of [
            "img-src",
            "media-src",
            "frame-src",
            "connect-src",
         ]) {
            expect(policy[directive]?.split(" ")).toContain("https:");
            expect(policy[directive]?.split(" ")).not.toContain("http:");
         }
      }
   );
});

describe("landing origin", () => {
   it("keeps the landing origin allowed for styles and fonts", async () => {
      vi.stubEnv("LANDING_ORIGIN", "http://landing:3001");
      const policy = await load({
         NEXT_PUBLIC_SITE_URL: "https://s3.example.com",
      });
      expect(policy["style-src"]).toContain("http://landing:3001");
      expect(policy["font-src"]).toContain("http://landing:3001");
   });
});

describe("script nonce", () => {
   const HTTPS = { NEXT_PUBLIC_SITE_URL: "https://s3.example.com" };

   it("keeps inline styles working, which have no nonce to carry", async () => {
      const policy = await load(HTTPS, { nonce: "n0nc3" });
      expect(policy["style-src"]).toContain("'unsafe-inline'");
   });

   it("leaves a proxied landing page on the host allowlist", async () => {
      vi.stubEnv("LANDING_ORIGIN", "http://landing:3001");
      const policy = await load(HTTPS);
      expect(policy["script-src"]).toContain("'unsafe-inline'");
      expect(policy["script-src"]).toContain("http://landing:3001");
      expect(policy["script-src"]).not.toContain("'strict-dynamic'");
   });

   it("keeps the dev server's eval and inline refresh scripts allowed", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const policy = await load(
         { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
         { nonce: "n0nc3" }
      );
      expect(policy["script-src"]).toContain("'unsafe-inline'");
      expect(policy["script-src"]).toContain("'unsafe-eval'");
      expect(policy["script-src"]).not.toContain("nonce-");
   });

   it.each(["production", "staging", "test", ""])(
      "fails closed when NODE_ENV is %j rather than development",
      async (nodeEnv) => {
         vi.stubEnv("NODE_ENV", nodeEnv);
         const policy = await load(HTTPS, { nonce: "n0nc3" });
         expect(policy["script-src"]).toBe(
            "'self' 'nonce-n0nc3' 'strict-dynamic'"
         );
         expect(policy["connect-src"]).not.toContain("ws:");
      }
   );
});

describe("hardening that never varies", () => {
   it("keeps the page unframeable and plugin-free", async () => {
      const policy = await load({
         NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      });
      expect(policy["frame-ancestors"]).toBe("'none'");
      expect(policy["object-src"]).toBe("'none'");
      expect(policy["base-uri"]).toBe("'self'");
      expect(policy["form-action"]).toBe("'self'");
   });
});
