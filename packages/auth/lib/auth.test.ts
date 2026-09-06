import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { DAY_MS, SESSION_ABSOLUTE_TTL_DAYS } from "@s3-viewer/types";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { auth as configured, onUserDeletion } from "./auth";

afterEach(() => vi.restoreAllMocks());

const createTestAuth = () => {
   const db: Parameters<typeof memoryAdapter>[0] = {
      user: [],
      session: [],
      account: [],
      verification: [],
   };
   const auth = betterAuth({
      ...configured.options,
      database: memoryAdapter(db),
      emailVerification: {
         ...configured.options.emailVerification,
         sendVerificationEmail: async () => {},
      },
   });
   const signUp = async (email: string) => {
      const response = await auth.api.signUpEmail({
         body: {
            email,
            password: "unique-test-password-2026",
            name: "Test User",
         },
         asResponse: true,
      });
      expect(response.status).toBe(200);
      const cookie = response.headers
         .getSetCookie()
         .map((value) => value.split(";")[0])
         .join("; ");
      const { user } = await response.json();
      return { cookie, user };
   };
   const post = (path: string, cookie: string, body: unknown) =>
      auth.handler(
         new Request(`http://localhost:5001/auth${path}`, {
            method: "POST",
            headers: {
               cookie,
               origin: "http://localhost:3000",
               "content-type": "application/json",
            },
            body: JSON.stringify(body),
         })
      );
   return { auth, db, signUp, post };
};

describe("account-bound deletion", () => {
   it("rejects a confirmation from account A when another tab switches the cookie to account B", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({ beforeDelete, afterDelete: async () => {} });
      const accountA = await signUp("delete-a@example.com");
      const accountB = await signUp("delete-b@example.com");
      const response = await post("/delete-user", accountB.cookie, {
         expectedUserId: accountA.user.id,
         confirmedEmail: accountA.user.email,
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "ACCOUNT_CHANGED" });
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(2);
      expect(db.session).toHaveLength(2);
   });

   it("rejects a wrong typed email and direct calls that omit confirmation, even with a password", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({ beforeDelete, afterDelete: async () => {} });
      const { cookie, user } = await signUp("delete-confirm@example.com");
      for (const body of [
         {},
         { password: "unique-test-password-2026" },
         { expectedUserId: user.id },
      ]) {
         expect((await post("/delete-user", cookie, body)).status).toBe(400);
      }
      expect(
         (
            await post("/delete-user", cookie, {
               expectedUserId: user.id,
               confirmedEmail: "someone-else@example.com",
            })
         ).status
      ).toBe(409);
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);
   });

   it("requires a session younger than 24 hours even when the password is supplied", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({ beforeDelete, afterDelete: async () => {} });
      const { cookie, user } = await signUp("delete-fresh@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - DAY_MS);
      const response = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: "unique-test-password-2026",
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "SESSION_EXPIRED" });
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);
   });

   it("preserves deletion cleanup hooks, deletes only the confirmed user and clears the cookie", async () => {
      const { auth, db, signUp, post } = createTestAuth();
      const { cookie, user } = await signUp("delete-success@example.com");
      const other = await signUp("delete-survivor@example.com");
      const hookTargets: string[] = [];
      onUserDeletion({
         beforeDelete: async (target) => {
            expect(db.user!.some((row) => row.id === target.id)).toBe(true);
            hookTargets.push(`before:${target.id}`);
         },
         afterDelete: async (target) => {
            expect(db.user!.some((row) => row.id === target.id)).toBe(false);
            hookTargets.push(`after:${target.id}`);
         },
      });
      const response = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: ` ${user.email.toUpperCase()} `,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true });
      expect(hookTargets).toEqual([`before:${user.id}`, `after:${user.id}`]);
      expect(db.user!.map((row) => row.id)).toEqual([other.user.id]);
      expect(db.session).toHaveLength(1);
      expect(
         response.headers
            .getSetCookie()
            .some(
               (value) =>
                  value.startsWith("better-auth.session_token=") &&
                  value.includes("Max-Age=0")
            )
      ).toBe(true);
      expect(
         await auth.api.getSession({ headers: new Headers({ cookie }) })
      ).toBeNull();
   });

   it("closes the unused token deletion callback", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie, user } = await signUp("delete-token@example.com");
      const context = await auth.$context;
      await context.internalAdapter.createVerificationValue({
         identifier: "delete-account-test-token",
         value: user.id,
         expiresAt: new Date(Date.now() + DAY_MS),
      });
      const response = await auth.handler(
         new Request(
            "http://localhost:5001/auth/delete-user/callback?token=test-token",
            { headers: { cookie } }
         )
      );
      expect(response.status).toBe(404);
      expect(db.user).toHaveLength(1);
   });
});

describe("absolute session expiry", () => {
   it("clears an expired cookie even on endpoints that do not require a session", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie } = await signUp("ttl-public@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - 91 * DAY_MS);
      db.session![0]!.expiresAt = new Date(Date.now() + DAY_MS);
      const response = await auth.api.ok({
         headers: new Headers({ cookie }),
         asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(db.session).toHaveLength(0);
      expect(
         response.headers
            .getSetCookie()
            .some(
               (value) =>
                  value.startsWith("better-auth.session_token=") &&
                  value.includes("Max-Age=0")
            )
      ).toBe(true);
   });

   it.each([SESSION_ABSOLUTE_TTL_DAYS, SESSION_ABSOLUTE_TTL_DAYS + 1])(
      "revokes a sliding session at %s days through getSession",
      async (ageDays) => {
         const { auth, db, signUp } = createTestAuth();
         const { cookie } = await signUp(`ttl-${ageDays}@example.com`);
         const now = Date.now();
         vi.spyOn(Date, "now").mockReturnValue(now);
         db.session![0]!.createdAt = new Date(now - ageDays * DAY_MS);
         db.session![0]!.expiresAt = new Date(now + DAY_MS);
         expect(
            await auth.api.getSession({ headers: new Headers({ cookie }) })
         ).toBeNull();
         expect(db.session).toHaveLength(0);
         const replay = await auth.handler(
            new Request("http://localhost:5001/auth/get-session", {
               headers: { cookie },
            })
         );
         expect(await replay.json()).toBeNull();
      }
   );

   it("prevents an over-age cookie changing the profile without first calling getSession", async () => {
      const { db, signUp, post } = createTestAuth();
      const { cookie } = await signUp("ttl-update@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - 91 * DAY_MS);
      db.session![0]!.expiresAt = new Date(Date.now() + DAY_MS);
      const response = await post("/update-user", cookie, {
         name: "Stolen cookie",
      });
      expect(response.status).toBe(401);
      expect(db.user![0]!.name).toBe("Test User");
      expect(db.session).toHaveLength(0);
   });

   it("prevents an over-age cookie revoking a newly signed-in session", async () => {
      const { auth, db, signUp, post } = createTestAuth();
      const { cookie, user } = await signUp("ttl-revoke@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - 91 * DAY_MS);
      db.session![0]!.expiresAt = new Date(Date.now() + DAY_MS);
      expect(
         (
            await auth.api.signInEmail({
               body: {
                  email: user.email,
                  password: "unique-test-password-2026",
               },
               asResponse: true,
            })
         ).status
      ).toBe(200);
      expect(db.session).toHaveLength(2);
      expect((await post("/revoke-other-sessions", cookie, {})).status).toBe(
         401
      );
      expect(db.session).toHaveLength(1);
      expect(Date.now() - db.session![0]!.createdAt.getTime()).toBeLessThan(
         DAY_MS
      );
   });

   it("allows sign-in with an over-age cookie and keeps the new session usable", async () => {
      const { auth, db, signUp, post } = createTestAuth();
      const { cookie, user } = await signUp("ttl-signin@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - 91 * DAY_MS);
      db.session![0]!.expiresAt = new Date(Date.now() + DAY_MS);
      const response = await post("/sign-in/email", cookie, {
         email: user.email,
         password: "unique-test-password-2026",
      });
      expect(response.status).toBe(200);
      expect(db.session).toHaveLength(1);
      const newCookie = response.headers
         .getSetCookie()
         .filter((value) => value.startsWith("better-auth.session_token="))
         .at(-1)!
         .split(";")[0]!;
      expect(newCookie).not.toContain("session_token=;");
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie: newCookie }),
         })
      ).not.toBeNull();
   });
});

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
