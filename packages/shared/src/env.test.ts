import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
   deriveSharedEnv,
   parseEnv,
   parseSharedEnv,
   signUpPolicyOf,
   withDefault,
} from "./env";

const BASE = {
   BETTER_AUTH_SECRET: "env-test-secret-at-least-thirty-two-characters",
   NEXT_PUBLIC_API_URL: "http://localhost:5001",
   NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

const parse = (overrides: Record<string, string> = {}) =>
   parseSharedEnv({ ...BASE, ...overrides });

describe("parseSharedEnv", () => {
   it("defaults the rate limit store to postgres and accepts memory in any case", () => {
      expect(parse().RATE_LIMIT_STORE).toBe("postgres");
      for (const value of ["memory", "Memory", " MEMORY "]) {
         expect(parse({ RATE_LIMIT_STORE: value }).RATE_LIMIT_STORE).toBe(
            "memory"
         );
      }
   });

   it("refuses a half-configured github pair", () => {
      expect(() => parse({ GITHUB_CLIENT_ID: "id" })).toThrow(
         /must be set together/
      );
      expect(() => parse({ GITHUB_CLIENT_SECRET: "secret" })).toThrow(
         /must be set together/
      );
      expect(
         parse({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" })
      ).toMatchObject({ GITHUB_CLIENT_ID: "id" });
   });

   it("refuses a secret shorter than 32 characters", () => {
      expect(() => parse({ BETTER_AUTH_SECRET: "short" })).toThrow(
         /BETTER_AUTH_SECRET/
      );
   });

   it("defaults cookies to lax and refuses other SameSite values", () => {
      expect(parse().COOKIE_SAMESITE).toBe("lax");
      expect(parse({ COOKIE_SAMESITE: "Lax" }).COOKIE_SAMESITE).toBe("lax");
      expect(() => parse({ COOKIE_SAMESITE: "strict" })).toThrow(
         /COOKIE_SAMESITE: must be `lax` or `none`/
      );
   });

   it("allows SameSite=None only on an https API", () => {
      expect(() => parse({ COOKIE_SAMESITE: "none" })).toThrow(
         /COOKIE_SAMESITE: `none` needs an https:\/\//
      );
      expect(
         parse({
            COOKIE_SAMESITE: "none",
            NEXT_PUBLIC_API_URL: "https://api.example.test",
         }).COOKIE_SAMESITE
      ).toBe("none");
   });

   it("reports a malformed API URL readably even with SameSite=None", () => {
      expect(() =>
         parse({ COOKIE_SAMESITE: "none", NEXT_PUBLIC_API_URL: "garbage" })
      ).toThrow(/Invalid environment: NEXT_PUBLIC_API_URL/);
   });

   it("reports every problem in one message", () => {
      expect(() =>
         parse({ COOKIE_SAMESITE: "strict", SIGNUP_MODE: "invite-only" })
      ).toThrow(
         /COOKIE_SAMESITE: .*; SIGNUP_MODE: must be one of open, domains, invite, closed/
      );
   });
});

describe("sign-up policy", () => {
   it("defaults to open", () => {
      expect(signUpPolicyOf(parse())).toEqual({
         mode: "open",
         allowedEmailDomains: [],
      });
   });

   it("infers `domains` from a list on its own", () => {
      expect(
         signUpPolicyOf(
            parse({ ALLOWED_EMAIL_DOMAINS: "@Acme.com, acme.dev\n acme.com" })
         )
      ).toEqual({
         mode: "domains",
         allowedEmailDomains: ["acme.com", "acme.dev"],
      });
   });

   it("keeps the list when the mode is explicitly open", () => {
      expect(
         signUpPolicyOf(
            parse({ SIGNUP_MODE: "open", ALLOWED_EMAIL_DOMAINS: "acme.com" })
         )
      ).toEqual({ mode: "open", allowedEmailDomains: ["acme.com"] });
   });

   it("refuses `domains` mode with no list", () => {
      expect(() => parse({ SIGNUP_MODE: "domains" })).toThrow(
         /ALLOWED_EMAIL_DOMAINS: required when SIGNUP_MODE is `domains`/
      );
   });

   it("accepts `invite` without a domain list", () => {
      expect(signUpPolicyOf(parse({ SIGNUP_MODE: "Invite" }))).toEqual({
         mode: "invite",
         allowedEmailDomains: [],
      });
   });

   it("refuses list entries no address could match", () => {
      expect(() =>
         parse({
            ALLOWED_EMAIL_DOMAINS:
               "acme.com, *.acme.dev, https://acme.io, acme.org., localhost",
         })
      ).toThrow(
         "ALLOWED_EMAIL_DOMAINS: each entry must be a bare domain such as `acme.com` (no wildcard, scheme or trailing dot); got `*.acme.dev`, `https://acme.io`, `acme.org.`, `localhost`"
      );
   });
});

describe("env helpers", () => {
   const schema = z.object({
      LIMIT: withDefault(z.coerce.number().int().positive(), 6),
   });

   it("falls back for an unset or blank variable and validates the rest", () => {
      expect(parseEnv(schema, {})).toEqual({ LIMIT: 6 });
      expect(parseEnv(schema, { LIMIT: "  " })).toEqual({ LIMIT: 6 });
      expect(parseEnv(schema, { LIMIT: " 12 " })).toEqual({ LIMIT: 12 });
      expect(() => parseEnv(schema, { LIMIT: "-1" })).toThrow(
         /^Invalid environment: LIMIT: /
      );
   });

   it("derives origins and the github pair from the shared variables", () => {
      expect(
         deriveSharedEnv({
            NEXT_PUBLIC_SITE_URL: "http://localhost:3000/app",
            NEXT_PUBLIC_API_URL: "https://api.example.test/base",
            GITHUB_CLIENT_ID: "id",
            GITHUB_CLIENT_SECRET: undefined,
         })
      ).toEqual({
         siteOrigin: "http://localhost:3000",
         apiOrigin: "https://api.example.test",
         apiIsHttps: true,
         github: null,
      });
   });
});
