import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// dotenv would fill the process env from a developer's own .env file and make
// the result depend on the machine the suite runs on
vi.mock("dotenv", () => ({ default: { config: () => ({ parsed: {} }) } }));

const BASE_ENV = {
   BETTER_AUTH_SECRET: "env-test-secret-at-least-thirty-two-characters",
   NEXT_PUBLIC_API_URL: "http://localhost:5001",
   NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

const original = process.env;

beforeEach(() => {
   vi.resetModules();
   process.env = { ...BASE_ENV } as NodeJS.ProcessEnv;
});

afterEach(() => {
   process.env = original;
});

const load = (env: Record<string, string>) => {
   Object.assign(process.env, env);
   return import("./env");
};

describe("sign-up policy env", () => {
   it("defaults to open", async () => {
      const { signUpPolicy } = await load({});
      expect(signUpPolicy).toEqual({ mode: "open", allowedEmailDomains: [] });
   });

   it("infers `domains` from a list on its own", async () => {
      const { signUpPolicy } = await load({
         ALLOWED_EMAIL_DOMAINS: "@Acme.com, acme.dev\n acme.com",
      });
      expect(signUpPolicy).toEqual({
         mode: "domains",
         allowedEmailDomains: ["acme.com", "acme.dev"],
      });
   });

   it("keeps the list when the mode is explicitly open", async () => {
      const { signUpPolicy } = await load({
         SIGNUP_MODE: "open",
         ALLOWED_EMAIL_DOMAINS: "acme.com",
      });
      expect(signUpPolicy.mode).toBe("open");
   });

   it("refuses to boot in `domains` mode with no list", async () => {
      await expect(load({ SIGNUP_MODE: "domains" })).rejects.toThrow(
         /ALLOWED_EMAIL_DOMAINS/
      );
   });

   it("accepts `invite` without a domain list", async () => {
      const { signUpPolicy } = await load({ SIGNUP_MODE: "invite" });
      expect(signUpPolicy).toEqual({ mode: "invite", allowedEmailDomains: [] });
   });

   it("refuses an unknown mode", async () => {
      await expect(load({ SIGNUP_MODE: "invite-only" })).rejects.toThrow(
         /SIGNUP_MODE/
      );
   });

   it("closes better auth's own sign-up endpoints when the mode is closed", async () => {
      Object.assign(process.env, {
         SIGNUP_MODE: "closed",
         GITHUB_CLIENT_ID: "client-id",
         GITHUB_CLIENT_SECRET: "client-secret",
      });
      vi.doMock("@s3-viewer/db", () => ({ prisma: {} }));
      vi.doMock("@s3-viewer/email", () => ({ sendAuthLinkEmail: vi.fn() }));
      const { auth } = await import("./auth");
      expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
      expect(auth.options.socialProviders?.github?.disableSignUp).toBe(true);
   });

   // only `closed` may shut better auth's endpoints: `invite` has to let an
   // invited address through, and the database hook is what decides
   it("leaves the sign-up endpoints open in `invite` mode", async () => {
      Object.assign(process.env, {
         SIGNUP_MODE: "invite",
         GITHUB_CLIENT_ID: "client-id",
         GITHUB_CLIENT_SECRET: "client-secret",
      });
      vi.doMock("@s3-viewer/db", () => ({ prisma: {} }));
      vi.doMock("@s3-viewer/email", () => ({ sendAuthLinkEmail: vi.fn() }));
      const { auth } = await import("./auth");
      expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
      expect(auth.options.socialProviders?.github?.disableSignUp).toBe(false);
   });
});
