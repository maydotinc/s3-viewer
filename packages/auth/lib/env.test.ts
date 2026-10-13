import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("auth env", () => {
   it("derives origins, cookie settings and the github pair", async () => {
      const { authEnv } = await load({
         NEXT_PUBLIC_API_URL: "https://api.example.test/base",
         COOKIE_SAMESITE: "none",
         GITHUB_CLIENT_ID: "client-id",
         GITHUB_CLIENT_SECRET: "client-secret",
      });
      expect(authEnv).toMatchObject({
         apiOrigin: "https://api.example.test",
         apiIsHttps: true,
         cookieSameSite: "none",
         siteOrigin: "http://localhost:3000",
         rateLimitStore: "postgres",
         github: { clientId: "client-id", clientSecret: "client-secret" },
      });
   });

   it("leaves github off when the pair is absent", async () => {
      const { authEnv } = await load({});
      expect(authEnv.github).toBeNull();
      expect(authEnv.cookieSameSite).toBe("lax");
   });

   it("refuses an invalid environment at import", async () => {
      await expect(load({ COOKIE_SAMESITE: "strict" })).rejects.toThrow(
         /Invalid environment: COOKIE_SAMESITE/
      );
   });
});

describe("sign-up policy", () => {
   it("closes better auth's own sign-up endpoints when the mode is closed", async () => {
      Object.assign(process.env, {
         SIGNUP_MODE: "closed",
         GITHUB_CLIENT_ID: "client-id",
         GITHUB_CLIENT_SECRET: "client-secret",
      });
      vi.doMock("@s3-viewer/db", () => ({ prisma: {} }));
      vi.doMock("@s3-viewer/email", () => ({
         sendPasswordResetEmail: vi.fn(),
         sendVerificationCodeEmail: vi.fn(),
      }));
      const { auth } = await import("./auth");
      expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
      expect(auth.options.socialProviders?.github?.disableSignUp).toBe(true);
   });

   it("leaves the sign-up endpoints open in `invite` mode", async () => {
      Object.assign(process.env, {
         SIGNUP_MODE: "invite",
         GITHUB_CLIENT_ID: "client-id",
         GITHUB_CLIENT_SECRET: "client-secret",
      });
      vi.doMock("@s3-viewer/db", () => ({ prisma: {} }));
      vi.doMock("@s3-viewer/email", () => ({
         sendPasswordResetEmail: vi.fn(),
         sendVerificationCodeEmail: vi.fn(),
      }));
      const { auth } = await import("./auth");
      expect(auth.options.emailAndPassword?.disableSignUp).toBe(false);
      expect(auth.options.socialProviders?.github?.disableSignUp).toBe(false);
   });
});
