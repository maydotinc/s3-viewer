import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));
vi.mock("@s3-viewer/email", () => ({ sendAuthLinkEmail: vi.fn() }));
vi.mock("./env", () => ({
   authEnv: {
      secret: "regression-test-secret-at-least-thirty-two-chars",
      apiOrigin: "http://localhost:5001",
      apiIsHttps: false,
      cookieSameSite: "lax",
      siteOrigin: "http://localhost:3000",
      github: null,
   },
}));

import { auth as configured } from "./auth";

describe("revoked sessions", () => {
   it("rejects legacy cached cookies for account unlinking immediately after revocation", async () => {
      const db = { user: [], session: [], account: [], verification: [] };
      const options = {
         ...configured.options,
         database: memoryAdapter(db),
         emailVerification: {
            ...configured.options.emailVerification,
            sendVerificationEmail: async () => {},
         },
      };
      const legacy = betterAuth({
         ...options,
         session: {
            ...options.session,
            cookieCache: { enabled: true, maxAge: 60 },
         },
      });
      const auth = betterAuth(options);
      const signup = await legacy.api.signUpEmail({
         body: {
            email: "cache-regression@example.com",
            password: "unique-test-password-2026",
            name: "Cache Test",
         },
         asResponse: true,
      });
      expect(signup.status).toBe(200);
      const cookie = signup.headers
         .getSetCookie()
         .map((value) => value.split(";")[0])
         .join("; ");
      expect(cookie).toContain("session_data=");
      const { user } = await signup.json();
      const context = await auth.$context;
      const github = await context.internalAdapter.linkAccount({
         providerId: "github",
         issuer: "local:oauth:github",
         accountId: "test-github",
         userId: user.id,
      });
      expect(db.account).toHaveLength(2);
      expect(
         await auth.api.getSession({ headers: new Headers({ cookie }) })
      ).not.toBeNull();
      await auth.api.signOut({ headers: new Headers({ cookie }) });
      expect(db.session).toHaveLength(0);
      expect(
         await auth.api.getSession({ headers: new Headers({ cookie }) })
      ).toBeNull();
      const unlink = await auth.handler(
         new Request("http://localhost:5001/auth/unlink-account", {
            method: "POST",
            headers: {
               cookie,
               origin: "http://localhost:3000",
               "content-type": "application/json",
            },
            body: JSON.stringify({ accountId: github.id }),
         })
      );
      expect(unlink.status).toBe(401);
      expect(db.account).toHaveLength(2);
   });
});
