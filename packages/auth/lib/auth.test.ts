import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createEmailVerificationToken } from "better-auth/api";
import {
   CLIENT_IP_HEADER,
   EXPECTED_USER_ID_HEADER,
   ACCOUNT_CHANGED_MESSAGE,
   DAY_MS,
   INVITE_TOKEN_HEADER,
   SESSION_ABSOLUTE_TTL_DAYS,
   type SignUpMode,
} from "@s3-viewer/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { policy, invitedAddresses, inviteLookups } = vi.hoisted(() => ({
   policy: {
      mode: "open" as SignUpMode,
      allowedEmailDomains: [] as string[],
   },
   invitedAddresses: new Map<string, string>(),
   inviteLookups: [] as Record<string, unknown>[],
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      pendingInvitation: {
         count: async ({
            where,
         }: {
            where: { email: string; token: string | undefined };
         }) => {
            inviteLookups.push(where);
            const token = invitedAddresses.get(where.email);
            return token && (where.token === undefined || where.token === token)
               ? 1
               : 0;
         },
      },
   },
}));
vi.mock("@s3-viewer/email", () => ({ sendAuthLinkEmail: vi.fn() }));
vi.mock("./env", () => ({
   authEnv: {
      secret: "regression-test-secret-at-least-thirty-two-chars",
      apiOrigin: "http://localhost:5001",
      apiIsHttps: false,
      cookieSameSite: "lax",
      siteOrigin: "http://localhost:3000",
      github: {
         clientId: "test-client-id",
         clientSecret: "test-client-secret",
      },
   },
   signUpPolicy: policy,
}));

import { sendAuthLinkEmail } from "@s3-viewer/email";
import { auth as configured, onUserDeletion } from "./auth";

const PASSWORD = "unique-test-password-2026";
const noSharedServers = async (): Promise<string[]> => [];

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
   policy.mode = "open";
   policy.allowedEmailDomains = [];
   invitedAddresses.clear();
   inviteLookups.length = 0;
});

// throttle tests run hundreds of sign-ins; real password hashing would dominate them.
const plainPasswords = {
   hash: async (password: string) => `plain:${password}`,
   verify: async ({ hash, password }: { hash: string; password: string }) =>
      hash === `plain:${password}`,
};

const createTestAuth = (enforceOrigin = false, fastPasswords = false) => {
   const db: Parameters<typeof memoryAdapter>[0] = {
      user: [],
      session: [],
      account: [],
      verification: [],
   };
   const auth = betterAuth({
      ...configured.options,
      database: memoryAdapter(db),
      ...(fastPasswords && {
         emailAndPassword: {
            ...configured.options.emailAndPassword,
            enabled: true,
            password: plainPasswords,
         },
      }),
      ...(enforceOrigin && {
         advanced: {
            ...configured.options.advanced,
            disableOriginCheck: false,
            disableCSRFCheck: false,
         },
      }),
      emailVerification: {
         ...configured.options.emailVerification,
         sendVerificationEmail: async () => {},
      },
   });
   const signUp = async (email: string) => {
      const response = await auth.api.signUpEmail({
         body: {
            email,
            password: PASSWORD,
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
   const post = (
      path: string,
      cookie: string,
      body: unknown,
      headers: Record<string, string> = {}
   ) =>
      auth.handler(
         new Request(`http://localhost:5001/auth${path}`, {
            method: "POST",
            headers: {
               cookie,
               origin: "http://localhost:3000",
               "content-type": "application/json",
               ...headers,
            },
            body: JSON.stringify(body),
         })
      );
   const rawSignUp = (email: string, inviteToken?: string) =>
      post(
         "/sign-up/email",
         "",
         { email, password: PASSWORD, name: "New" },
         inviteToken ? { [INVITE_TOKEN_HEADER]: inviteToken } : {}
      );
   return { auth, db, post, rawSignUp, signUp };
};

describe("account-bound authenticated writes", () => {
   it("refuses stale-tab account writes before changing the cookie account", async () => {
      const { db, signUp, post } = createTestAuth();
      const accountA = await signUp("actor-a@example.com");
      const accountB = await signUp("actor-b@example.com");
      const tokenB = db.session!.find(
         (row) => row.userId === accountB.user.id
      )!.token;
      const writes: [string, unknown][] = [
         ["/update-user", { name: "Wrong account" }],
         [
            "/change-password",
            {
               currentPassword: PASSWORD,
               newPassword: "another-strong-password",
               revokeOtherSessions: true,
            },
         ],
         ["/revoke-session", { token: tokenB }],
         ["/revoke-other-sessions", {}],
         ["/revoke-sessions", {}],
         ["/sign-out", {}],
         [
            "/delete-user",
            {
               expectedUserId: accountB.user.id,
               confirmedEmail: accountB.user.email,
               password: PASSWORD,
            },
         ],
      ];
      for (const [path, body] of writes) {
         const response = await post(path, accountB.cookie, body, {
            [EXPECTED_USER_ID_HEADER]: accountA.user.id,
         });
         expect(response.status, path).toBe(403);
         expect(await response.json()).toMatchObject({
            code: "ACCOUNT_CHANGED",
         });
      }
      expect(db.user!.map((row) => row.name)).toEqual([
         "Test User",
         "Test User",
      ]);
      expect(db.session).toHaveLength(2);
   });

   it("keeps actor-bound sign-out idempotent after session revocation or absolute expiry", async () => {
      const { db, signUp, post } = createTestAuth();
      const revoked = await signUp("actor-revoked@example.com");
      db.session!.length = 0;
      const expired = await signUp("actor-expired@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - 91 * DAY_MS);
      for (const account of [
         revoked,
         expired,
         { cookie: "", user: { id: "missing-user" } },
      ]) {
         const response = await post(
            "/sign-out",
            account.cookie,
            {},
            { [EXPECTED_USER_ID_HEADER]: account.user.id }
         );
         expect(response.status).toBe(200);
      }
      expect(db.session).toHaveLength(0);
   });

   it("allows matching actors and existing clients that omit the optional header", async () => {
      const { db, signUp, post } = createTestAuth();
      const account = await signUp("actor-matching@example.com");
      const bound = await post(
         "/update-user",
         account.cookie,
         { name: "Bound update" },
         { [EXPECTED_USER_ID_HEADER]: account.user.id }
      );
      expect(bound.status).toBe(200);
      expect(db.user![0]!.name).toBe("Bound update");
      const legacy = await post("/update-user", account.cookie, {
         name: "Legacy update",
      });
      expect(legacy.status).toBe(200);
      expect(db.user![0]!.name).toBe("Legacy update");
   });
});

describe("account-bound deletion", () => {
   it("rejects a confirmation from account A when another tab switches the cookie to account B", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete,
         afterDelete: async () => {},
      });
      const accountA = await signUp("delete-a@example.com");
      const accountB = await signUp("delete-b@example.com");
      const response = await post("/delete-user", accountB.cookie, {
         expectedUserId: accountA.user.id,
         confirmedEmail: accountA.user.email,
         password: PASSWORD,
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
         code: "ACCOUNT_CHANGED",
         message: ACCOUNT_CHANGED_MESSAGE,
      });
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(2);
      expect(db.session).toHaveLength(2);
   });

   it("rejects a wrong typed email and direct calls that omit confirmation, even with a password", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete,
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("delete-confirm@example.com");
      for (const body of [
         {},
         { password: PASSWORD },
         { expectedUserId: user.id },
      ]) {
         expect((await post("/delete-user", cookie, body)).status).toBe(400);
      }
      expect(
         (
            await post("/delete-user", cookie, {
               expectedUserId: user.id,
               confirmedEmail: "someone-else@example.com",
               password: PASSWORD,
            })
         ).status
      ).toBe(403);
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);
   });

   it("requires a session younger than 24 hours even when the password is supplied", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete,
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("delete-fresh@example.com");
      db.session![0]!.createdAt = new Date(Date.now() - DAY_MS);
      const response = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: PASSWORD,
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
         sharedServerNames: noSharedServers,
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
         password: PASSWORD,
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
                  password: PASSWORD,
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
         password: PASSWORD,
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

   it("revokes the row, not just the cookie, on the api middleware's path", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie } = await signUp("ttl-guard@example.com");
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      db.session![0]!.createdAt = new Date(
         now - SESSION_ABSOLUTE_TTL_DAYS * DAY_MS
      );
      db.session![0]!.expiresAt = new Date(now + DAY_MS);
      const response = await auth.api.getSession({
         headers: new Headers({ cookie }),
         query: { disableCookieCache: true },
         asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
      expect(db.session).toHaveLength(0);
      expect(
         response.headers
            .getSetCookie()
            .filter((value) => value.startsWith("better-auth.session_token="))
            .at(-1)
      ).toContain("Max-Age=0");
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie }),
            query: { disableCookieCache: true },
         })
      ).toBeNull();
   });

   it("revokes the row on the first http get-session that reaches it", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie } = await signUp("ttl-guard-http@example.com");
      db.session![0]!.createdAt = new Date(
         Date.now() - SESSION_ABSOLUTE_TTL_DAYS * DAY_MS
      );
      db.session![0]!.expiresAt = new Date(Date.now() + DAY_MS);
      const response = await auth.handler(
         new Request("http://localhost:5001/auth/get-session", {
            headers: { cookie },
         })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
      expect(db.session).toHaveLength(0);
      expect(
         response.headers
            .getSetCookie()
            .filter((value) => value.startsWith("better-auth.session_token="))
            .at(-1)
      ).toContain("Max-Age=0");
   });
});

describe("revocation takes effect immediately", () => {
   it("rejects a session revoked between two get-session calls", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie } = await signUp("revoked@example.com");
      const read = () =>
         auth.api.getSession({
            headers: new Headers({ cookie }),
            query: { disableCookieCache: true },
         });
      expect(await read()).not.toBeNull();
      const context = await auth.$context;
      await context.internalAdapter.deleteSession(db.session![0]!.token);
      expect(await read()).toBeNull();
   });
});

describe("revoked sessions", () => {
   it("rejects legacy cached cookies immediately after revocation", async () => {
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
            password: PASSWORD,
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
      await context.internalAdapter.linkAccount({
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
      const revoke = await auth.handler(
         new Request("http://localhost:5001/auth/revoke-other-sessions", {
            method: "POST",
            headers: {
               cookie,
               origin: "http://localhost:3000",
               "content-type": "application/json",
            },
            body: "{}",
         })
      );
      expect(revoke.status).toBe(401);
      const fresh = await auth.api.signInEmail({
         body: { email: "cache-regression@example.com", password: PASSWORD },
         asResponse: true,
      });
      const freshCookie = fresh.headers
         .getSetCookie()
         .map((value) => value.split(";")[0])
         .join("; ");
      const unlink = await auth.handler(
         new Request("http://localhost:5001/auth/unlink-account", {
            method: "POST",
            headers: {
               cookie: freshCookie,
               origin: "http://localhost:3000",
               "content-type": "application/json",
            },
            body: JSON.stringify({
               providerId: "credential",
               accountId: (
                  db.account as { id: string; providerId: string }[]
               ).find((row) => row.providerId === "credential")?.id,
            }),
         })
      );
      expect(unlink.status).toBe(404);
      expect(db.account).toHaveLength(2);
   });
});

describe("sign-up policy", () => {
   it("refuses every sign-up when the instance is closed", async () => {
      policy.mode = "closed";
      const { db, rawSignUp } = createTestAuth();
      const response = await rawSignUp("Closed@Example.com");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
         code: "SIGNUP_DISABLED",
         message:
            "Sign-ups are disabled on this instance. Ask an administrator for access.",
      });
      expect(db.user).toHaveLength(0);
   });

   it("refuses an unlisted domain and records the address it turned away", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com", "acme.dev"];
      const { db, rawSignUp } = createTestAuth();
      const response = await rawSignUp("Outsider@Other.COM");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
         code: "SIGNUP_INVITE_REQUIRED",
         message:
            "Sign-ups are limited to @acme.com and @acme.dev addresses, or to the link in an invitation email.",
      });
      expect(db.user).toHaveLength(0);
   });

   it("accepts a listed domain", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com"];
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("worker@acme.com")).status).toBe(200);
      expect(db.user).toHaveLength(1);
   });

   it("accepts an off-domain address that presents its live invitation", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com"];
      invitedAddresses.set("guest@other.com", "inviteguest01");
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("Guest@Other.com", "inviteguest01")).status).toBe(
         200
      );
      expect(db.user).toHaveLength(1);
   });

   it("refuses an uninvited address in `invite` mode and accepts an invited one with its token", async () => {
      policy.mode = "invite";
      invitedAddresses.set("invited@example.com", "inviteabc123");
      const { db, rawSignUp } = createTestAuth();
      const refused = await rawSignUp("stranger@example.com");
      expect(refused.status).toBe(403);
      expect(await refused.json()).toMatchObject({
         code: "SIGNUP_INVITE_REQUIRED",
         message:
            "Sign-ups are by invitation. Open the link in your invitation email to create your account.",
      });
      expect(
         (await rawSignUp("Invited@Example.com", "inviteabc123")).status
      ).toBe(200);
      expect(db.user).toHaveLength(1);
   });

   it("refuses a password sign-up for an invited address without its token, or with another invitation's token", async () => {
      policy.mode = "invite";
      invitedAddresses.set("invited@example.com", "inviteabc123");
      invitedAddresses.set("other@example.com", "inviteother99");
      const { db, rawSignUp } = createTestAuth();
      for (const token of [undefined, "inviteother99", "not a token"]) {
         const refused = await rawSignUp("invited@example.com", token);
         expect(refused.status).toBe(403);
         expect(await refused.json()).toMatchObject({
            code: "SIGNUP_INVITE_REQUIRED",
         });
      }
      expect(db.user).toHaveLength(0);
   });

   it("matches the presented value against the invite's token and never its id", async () => {
      policy.mode = "invite";
      const token = "q8Zr-3XlY_7mTt0aVb1Kc2Dd4Ee5Ff6Gg7Hh8Ii9JjA";
      invitedAddresses.set("invited@example.com", token);
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("invited@example.com", token)).status).toBe(200);
      expect(db.user).toHaveLength(1);
      expect(inviteLookups.length).toBeGreaterThan(0);
      for (const where of inviteLookups) {
         expect(where).toMatchObject({ email: "invited@example.com", token });
         expect(where).not.toHaveProperty("id");
      }
   });

   it("answers an existing account and an unknown address alike when no invitation is presented", async () => {
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("member@example.com")).status).toBe(200);
      expect((await rawSignUp("member@example.com")).status).toBe(422);
      for (const [mode, domains] of [
         ["invite", []],
         ["domains", ["acme.com"]],
      ] as const) {
         policy.mode = mode;
         policy.allowedEmailDomains = [...domains];
         const answers = [];
         for (const email of ["member@example.com", "stranger@example.com"]) {
            const refused = await rawSignUp(email, "guessedtoken1");
            answers.push({
               status: refused.status,
               body: await refused.json(),
            });
         }
         expect(answers[0]?.status).toBe(403);
         expect(answers[0]?.body).toMatchObject({
            code: "SIGNUP_INVITE_REQUIRED",
         });
         expect(answers[1]).toEqual(answers[0]);
      }
      expect(db.user).toHaveLength(1);
   });

   it("still tells an invited or listed address that its account already exists", async () => {
      const { rawSignUp } = createTestAuth();
      expect((await rawSignUp("member@acme.com")).status).toBe(200);
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com"];
      expect((await rawSignUp("member@acme.com")).status).toBe(422);
      policy.mode = "invite";
      invitedAddresses.set("member@acme.com", "inviteabc123");
      expect((await rawSignUp("member@acme.com", "inviteabc123")).status).toBe(
         422
      );
   });

   it("accepts an invited address from a provider that verified it, without a token", async () => {
      policy.mode = "invite";
      invitedAddresses.set("invited@example.com", "inviteabc123");
      const { auth, db } = createTestAuth();
      const context = await auth.$context;
      await context.internalAdapter.createUser(
         { email: "invited@example.com", name: "Invited", emailVerified: true },
         { method: "github" }
      );
      expect(db.user).toHaveLength(1);
      await expect(
         context.internalAdapter.createUser(
            { email: "other@example.com", name: "Other", emailVerified: false },
            { method: "github" }
         )
      ).rejects.toMatchObject({ body: { code: "SIGNUP_INVITE_REQUIRED" } });
      expect(db.user).toHaveLength(1);
   });

   it("ignores an invitation when the instance is closed", async () => {
      policy.mode = "closed";
      invitedAddresses.set("invited@example.com", "inviteabc123");
      const { db, rawSignUp } = createTestAuth();
      const response = await rawSignUp("invited@example.com");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "SIGNUP_DISABLED" });
      expect(db.user).toHaveLength(0);
   });

   it("still refuses a user row when only the database hook is reached", async () => {
      policy.mode = "closed";
      const { auth, db } = createTestAuth();
      const context = await auth.$context;
      await expect(
         context.internalAdapter.createUser(
            {
               email: "backdoor@example.com",
               name: "Backdoor",
               emailVerified: false,
            },
            { method: "email" }
         )
      ).rejects.toMatchObject({ body: { code: "SIGNUP_DISABLED" } });
      expect(db.user).toHaveLength(0);
   });
});

describe("password-confirmed deletion", () => {
   it("refuses a wrong password and deletes on the right one", async () => {
      const { db, post, signUp } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete,
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("delete-password@example.com");
      const confirmation = {
         expectedUserId: user.id,
         confirmedEmail: user.email,
      };
      const wrong = await post("/delete-user", cookie, {
         ...confirmation,
         password: "not-the-password",
      });
      expect(wrong.status).toBe(400);
      expect(await wrong.json()).toMatchObject({ code: "INVALID_PASSWORD" });
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);
      expect(
         (
            await post("/delete-user", cookie, {
               ...confirmation,
               password: PASSWORD,
            })
         ).status
      ).toBe(200);
      expect(db.user).toHaveLength(0);
   });

   it("sends an account with no password to set one first", async () => {
      const { auth, db, post, signUp } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete,
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("delete-oauth@example.com");
      const context = await auth.$context;
      const credential = db.account!.find(
         (row) => row.providerId === "credential"
      )!;
      await context.internalAdapter.deleteAccount(credential.id);
      const response = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: PASSWORD,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: "PASSWORD_NOT_SET",
      });
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);
   });
});

describe("hashed verification identifiers", () => {
   it("still completes a password reset, and never stores the raw token", async () => {
      let resetUrl = "";
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
         emailAndPassword: {
            ...configured.options.emailAndPassword,
            enabled: true,
            sendResetPassword: async ({ url }) => {
               resetUrl = url;
            },
         },
      });
      await auth.api.signUpEmail({
         body: {
            email: "reset-hashed@example.com",
            password: PASSWORD,
            name: "Reset",
         },
      });
      await auth.api.requestPasswordReset({
         body: {
            email: "reset-hashed@example.com",
            redirectTo: "http://localhost:3000/reset-password",
         },
      });
      const token = new URL(resetUrl).pathname.split("/").at(-1)!;
      expect(
         db.verification!.some((row) => row.identifier.includes(token))
      ).toBe(false);
      await auth.api.resetPassword({
         body: { token, newPassword: "a-brand-new-password-2026" },
      });
      expect(
         (
            await auth.api.signInEmail({
               body: {
                  email: "reset-hashed@example.com",
                  password: "a-brand-new-password-2026",
               },
               asResponse: true,
            })
         ).status
      ).toBe(200);
   });
});

describe("auth link delivery", () => {
   const requestReset = (
      auth: ReturnType<typeof createTestAuth>["auth"],
      email = "slow-mail@example.com"
   ) =>
      auth.api.requestPasswordReset({
         body: { email, redirectTo: "http://localhost:3000/reset-password" },
      });

   it("answers a reset request without waiting for the email, so timing reveals no account", async () => {
      const { auth, signUp } = createTestAuth();
      await signUp("slow-mail@example.com");
      vi.mocked(sendAuthLinkEmail).mockClear();
      let deliver!: () => void;
      vi.mocked(sendAuthLinkEmail).mockImplementationOnce(
         () =>
            new Promise<void>((resolve) => {
               deliver = resolve;
            })
      );
      await expect(requestReset(auth)).resolves.toMatchObject({
         status: true,
      });
      expect(sendAuthLinkEmail).toHaveBeenCalledWith(
         expect.objectContaining({
            to: "slow-mail@example.com",
            intent: "reset",
         })
      );
      deliver();
   });

   it("logs a failed delivery instead of failing the request", async () => {
      const { auth, signUp } = createTestAuth();
      await signUp("failing-mail@example.com");
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(sendAuthLinkEmail).mockRejectedValueOnce(
         new Error("SMTP unavailable")
      );
      await expect(
         requestReset(auth, "failing-mail@example.com")
      ).resolves.toMatchObject({
         status: true,
      });
      await vi.waitFor(() =>
         expect(logged).toHaveBeenCalledWith(
            expect.stringContaining("SMTP unavailable")
         )
      );
   });
});

describe("github provider", () => {
   const PROFILE = {
      id: 42,
      login: "octocat",
      name: "Octo Cat",
      email: "octo@example.com",
      avatar_url: "https://avatars.example/octo.png",
   };

   const stubGithubApi = (emails: { email: string; verified: boolean }[]) =>
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
         const url = String(input instanceof Request ? input.url : input);
         const body = url.endsWith("/user/emails")
            ? emails.map((entry) => ({ ...entry, primary: true }))
            : PROFILE;
         return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
         });
      });

   const githubProvider = async () => {
      const { auth } = createTestAuth();
      const context = await auth.$context;
      const provider = context.socialProviders.find(
         (candidate) => candidate.id === "github"
      );
      expect(provider).toBeDefined();
      return provider!;
   };

   it("keeps github's own verified flag instead of forcing it true", async () => {
      stubGithubApi([{ email: PROFILE.email, verified: false }]);
      const provider = await githubProvider();
      const info = await provider.getUserInfo!({ accessToken: "token" });
      expect(info?.user.emailVerified).toBe(false);
      expect(info?.user.image).toBeUndefined();
   });

   it("passes a github-verified address through as verified", async () => {
      stubGithubApi([{ email: PROFILE.email, verified: true }]);
      const provider = await githubProvider();
      const info = await provider.getUserInfo!({ accessToken: "token" });
      expect(info?.user.emailVerified).toBe(true);
   });

   it("uses a validated provider login when the display name is unsupported", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
         const url = String(input instanceof Request ? input.url : input);
         return new Response(
            JSON.stringify(
               url.endsWith("/user/emails")
                  ? [{ email: PROFILE.email, verified: true, primary: true }]
                  : { ...PROFILE, name: "invalid\nname" }
            ),
            { headers: { "content-type": "application/json" } }
         );
      });
      const { auth, db } = createTestAuth();
      const context = await auth.$context;
      const provider = context.socialProviders.find(
         (candidate) => candidate.id === "github"
      )!;
      const info = await provider.getUserInfo!({ accessToken: "token" });
      expect(info?.user).toMatchObject({
         name: "octocat",
         emailVerified: true,
      });
      await context.internalAdapter.createUser(
         { email: PROFILE.email, name: info!.user.name!, emailVerified: true },
         { method: "oauth", oauth: { providerId: "github" } }
      );
      expect(db.user?.[0]?.name).toBe("octocat");
   });

   const githubCallback = async (
      emails: { email: string; verified: boolean }[]
   ) => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
         const url = String(input instanceof Request ? input.url : input);
         const body = url.includes("/login/oauth/access_token")
            ? { access_token: "token", token_type: "bearer", scope: "user" }
            : url.endsWith("/user/emails")
              ? emails.map((entry) => ({ ...entry, primary: true }))
              : PROFILE;
         return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
         });
      });
      const testAuth = createTestAuth();
      const started = await testAuth.post("/sign-in/social", "", {
         provider: "github",
         callbackURL: "http://localhost:3000/dashboard",
      });
      const cookie = started.headers
         .getSetCookie()
         .map((value) => value.split(";")[0])
         .join("; ");
      const { url } = (await started.json()) as { url: string };
      const state = new URL(url).searchParams.get("state")!;
      const finished = await testAuth.auth.handler(
         new Request(
            `http://localhost:5001/auth/callback/github?code=code&state=${state}`,
            { headers: { cookie } }
         )
      );
      return { ...testAuth, finished };
   };

   it("refuses to create a user from an address github has not verified", async () => {
      const { db, finished } = await githubCallback([
         { email: PROFILE.email, verified: false },
      ]);
      expect(finished.headers.get("location")).toContain(
         "error=PROVIDER_EMAIL_UNVERIFIED"
      );
      expect(db.user).toHaveLength(0);
      expect(db.account).toHaveLength(0);
   });

   it("creates a user from a github-verified address", async () => {
      const { db, finished } = await githubCallback([
         { email: PROFILE.email, verified: true },
      ]);
      expect(finished.headers.get("location")).toBe(
         "http://localhost:3000/dashboard"
      );
      expect(db.user).toMatchObject([
         { email: PROFILE.email, emailVerified: true },
      ]);
   });

   it("trusts no provider for account linking", () => {
      expect(configured.options.account?.accountLinking).toEqual({
         enabled: true,
         requireLocalEmailVerified: true,
      });
   });
});

describe("session renewal", () => {
   it("still lets a near-expiry session refresh through get-session's own read", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { cookie } = await signUp("refresh@example.com");
      const nearExpiry = Date.now() + DAY_MS;
      db.session![0]!.expiresAt = new Date(nearExpiry);
      const session = await auth.api.getSession({
         headers: new Headers({ cookie }),
         query: { disableCookieCache: true },
      });
      expect(session).not.toBeNull();
      expect(db.session![0]!.expiresAt.getTime()).toBeGreaterThan(
         nearExpiry + 5 * DAY_MS
      );
   });
});

describe("per-account throttles", () => {
   it("stops sign-up attempts for one address from one ip after ten in a window", async () => {
      const { rawSignUp } = createTestAuth();
      for (let attempt = 0; attempt < 10; attempt++) {
         const response = await rawSignUp("probe@example.com");
         expect(response.status).toBe(attempt === 0 ? 200 : 422);
      }
      const refused = await rawSignUp("probe@example.com");
      expect(refused.status).toBe(429);
      expect(await refused.json()).toMatchObject({ code: "RATE_LIMITED" });
      expect((await rawSignUp("someone-else@example.com")).status).toBe(200);
   });

   it("folds every over-long address into one bucket per ip", async () => {
      const { auth } = createTestAuth();
      const signIn = (attempt: number) =>
         auth.handler(
            new Request("http://localhost:5001/auth/sign-in/email", {
               method: "POST",
               headers: {
                  origin: "http://localhost:3000",
                  "content-type": "application/json",
                  [CLIENT_IP_HEADER]: "203.0.113.9",
               },
               body: JSON.stringify({
                  email: `${"a".repeat(300)}${attempt}@example.com`,
                  password: PASSWORD,
               }),
            })
         );
      for (let attempt = 0; attempt < 10; attempt++) {
         expect((await signIn(attempt)).status).not.toBe(429);
      }
      expect((await signIn(10)).status).toBe(429);
   });

   it("stops one source from fanning reset and verification mail out across many addresses", async () => {
      const { post } = createTestAuth();
      const ask = (path: string, ip: string, n: number) =>
         post(
            path,
            "",
            { email: `fan-${ip}-${n}@example.com` },
            { [CLIENT_IP_HEADER]: ip }
         );
      for (let n = 0; n < 10; n++) {
         const allowed = await ask(
            "/request-password-reset",
            "198.51.100.7",
            n
         );
         expect(allowed.status).not.toBe(429);
      }
      for (const path of [
         "/request-password-reset",
         "/send-verification-email",
      ]) {
         const refused = await ask(path, "198.51.100.7", 10);
         expect(refused.status).toBe(429);
         expect(await refused.json()).toMatchObject({ code: "RATE_LIMITED" });
         expect((await ask(path, "198.51.100.8", 0)).status).not.toBe(429);
      }
   });

   it("does not spend an address's mail budget on requests its source was refused for", async () => {
      const { post } = createTestAuth();
      const ask = (email: string, ip: string) =>
         post(
            "/request-password-reset",
            "",
            { email },
            { [CLIENT_IP_HEADER]: ip }
         );
      for (let n = 0; n < 10; n++) {
         await ask(`filler-${n}@example.com`, "192.0.2.44");
      }
      for (let n = 0; n < 6; n++) {
         expect((await ask("victim@example.com", "192.0.2.44")).status).toBe(
            429
         );
      }
      expect((await ask("victim@example.com", "192.0.2.45")).status).not.toBe(
         429
      );
   });

   it("keeps requests that carry no source address out of one shared mail bucket", async () => {
      const { post } = createTestAuth();
      for (let n = 0; n < 12; n++) {
         const response = await post("/request-password-reset", "", {
            email: `no-source-${n}@example.com`,
         });
         expect(response.status).not.toBe(429);
      }
   });

   it("bounds password checks per account so a stolen cookie is not a password oracle", async () => {
      const { post, signUp } = createTestAuth();
      const { cookie, user } = await signUp("oracle@example.com");
      const guess = () =>
         post("/change-password", cookie, {
            currentPassword: "not-the-password",
            newPassword: "another-unique-password-2026",
         });
      for (let attempt = 0; attempt < 10; attempt++) {
         expect((await guess()).status).toBe(400);
      }
      expect((await guess()).status).toBe(429);
      const deletion = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: "not-the-password",
      });
      expect(deletion.status).toBe(429);
   });

   it("leaves a request without a session to the endpoint's own answer", async () => {
      const { post } = createTestAuth();
      const response = await post("/change-password", "", {
         currentPassword: "x",
         newPassword: "another-unique-password-2026",
      });
      expect(response.status).toBe(401);
   });

   it("does not answer /verify-password over http, with or without a session", async () => {
      const { post, signUp } = createTestAuth();
      const { cookie } = await signUp("oracle-http@example.com");
      const guess = await post("/verify-password", cookie, {
         password: "not-the-password",
      });
      expect(guess.status).toBe(404);
      const correct = await post("/verify-password", cookie, {
         password: PASSWORD,
      });
      expect(correct.status).toBe(404);
      const anonymous = await post("/verify-password", "", {
         password: PASSWORD,
      });
      expect(anonymous.status).toBe(404);
   });

   it("bounds /verify-password per account on the server-side call path", async () => {
      const { auth, signUp } = createTestAuth();
      const { cookie } = await signUp("oracle-api@example.com");
      const guess = () =>
         auth.api.verifyPassword({
            body: { password: "not-the-password" },
            headers: new Headers({ cookie }),
         });
      for (let attempt = 0; attempt < 10; attempt++) {
         await expect(guess()).rejects.toMatchObject({ status: "BAD_REQUEST" });
      }
      await expect(guess()).rejects.toMatchObject({
         status: "TOO_MANY_REQUESTS",
      });
   });
});

describe("signup and profile domain validation", () => {
   it.each(["a".repeat(81), "a".repeat(60_000), "bad\r\nname", "   "])(
      "refuses invalid signup names before storage",
      async (name) => {
         const { db, post } = createTestAuth(true);
         const response = await post("/sign-up/email", "", {
            email: `name-${name.length}@example.com`,
            name,
            password: PASSWORD,
         });
         expect([400, 422]).toContain(response.status);
         expect(db.user).toHaveLength(0);
      }
   );

   it("refuses overlong email addresses before storage", async () => {
      const { db, post } = createTestAuth(true);
      const response = await post("/sign-up/email", "", {
         email: `${"a".repeat(300)}@example.com`,
         name: "Valid",
         password: PASSWORD,
      });
      expect([400, 422]).toContain(response.status);
      expect(db.user).toHaveLength(0);
   });

   it("accepts 80-character signup names and 254-character normalized emails", async () => {
      const { db, post } = createTestAuth(true);
      const email = `${"a".repeat(242)}@example.com`;
      const response = await post("/sign-up/email", "", {
         email,
         name: "a".repeat(80),
         password: PASSWORD,
      });
      expect(response.status).toBe(200);
      expect(db.user?.[0]).toMatchObject({ email, name: "a".repeat(80) });
   });

   it("accepts boundary names, normalizes email and validates later profile changes", async () => {
      const { db, post, signUp } = createTestAuth(true);
      const { cookie } = await signUp("Valid@Example.com");
      expect(db.user?.[0]?.email).toBe("valid@example.com");
      expect(
         (await post("/update-user", cookie, { name: "a".repeat(80) })).status
      ).toBe(200);
      expect(
         (await post("/update-user", cookie, { name: "a".repeat(81) })).status
      ).toBe(400);
      expect(
         (await post("/update-user", cookie, { name: "bad\nname" })).status
      ).toBe(400);
      db.user![0]!.name = "legacy invalid\nname";
      expect(
         (await post("/update-user", cookie, { name: "  Repaired  " })).status
      ).toBe(200);
      expect(db.user?.[0]?.name).toBe("Repaired");
   });
});

const cookieOf = (response: Response): string =>
   response.headers
      .getSetCookie()
      .filter((value) => value.startsWith("better-auth.session_token="))
      .at(-1)!
      .split(";")[0]!;

describe("throttles nobody else can spend for you", () => {
   it("caps password sign-ups per source ip on the canonical path", async () => {
      const { post } = createTestAuth(false, true);
      const signUpFrom = (ip: string, n: number) =>
         post(
            "/sign-up/email",
            "",
            {
               email: `ip-cap-${ip}-${n}@example.com`,
               password: PASSWORD,
               name: "N",
            },
            { [CLIENT_IP_HEADER]: ip }
         );
      for (let n = 0; n < 10; n++) {
         expect((await signUpFrom("203.0.113.50", n)).status).toBe(200);
      }
      const refused = await signUpFrom("203.0.113.50", 10);
      expect(refused.status).toBe(429);
      expect(await refused.json()).toMatchObject({ code: "RATE_LIMITED" });
      expect((await signUpFrom("203.0.113.51", 0)).status).toBe(200);
   });

   it("does not spend the ip sign-up budget on sign-ups that fail", async () => {
      const { post, signUp } = createTestAuth(false, true);
      await signUp("ip-taken@example.com");
      const ip = { [CLIENT_IP_HEADER]: "203.0.113.60" };
      const body = (email: string) => ({
         email,
         password: PASSWORD,
         name: "N",
      });
      for (let n = 0; n < 9; n++) {
         const duplicate = await post(
            "/sign-up/email",
            "",
            body("ip-taken@example.com"),
            ip
         );
         expect(duplicate.status).toBe(422);
      }
      for (let n = 0; n < 10; n++) {
         const fresh = await post(
            "/sign-up/email",
            "",
            body(`ip-fresh-${n}@example.com`),
            ip
         );
         expect(fresh.status).toBe(200);
      }
   });

   it("lets the owner sign in from another ip after an attacker ip is cut off", async () => {
      const { post, signUp } = createTestAuth(false, true);
      const { user } = await signUp("lockout-victim@example.com");
      const signIn = (ip: string, password: string) =>
         post(
            "/sign-in/email",
            "",
            { email: user.email, password },
            { [CLIENT_IP_HEADER]: ip }
         );
      for (let n = 0; n < 10; n++) {
         expect(
            (await signIn("198.51.100.66", "wrong-password-1")).status
         ).toBe(401);
      }
      expect((await signIn("198.51.100.66", "wrong-password-1")).status).toBe(
         429
      );
      expect((await signIn("198.51.100.67", PASSWORD)).status).toBe(200);
   });

   it("counts only failed sign-ins toward the per-address cap", async () => {
      const { post, signUp } = createTestAuth(false, true);
      const { user } = await signUp("failure-budget@example.com");
      const signIn = (ip: string, password: string) =>
         post(
            "/sign-in/email",
            "",
            { email: user.email, password },
            { [CLIENT_IP_HEADER]: ip }
         );
      for (let ip = 0; ip < 10; ip++) {
         for (let n = 0; n < 10; n++) {
            expect((await signIn(`192.0.2.${ip}`, PASSWORD)).status).toBe(200);
         }
      }
      for (let ip = 10; ip < 20; ip++) {
         for (let n = 0; n < 10; n++) {
            expect(
               (await signIn(`192.0.2.${ip}`, "wrong-password")).status
            ).toBe(401);
         }
      }
      const capped = await signIn("192.0.2.20", PASSWORD);
      expect(capped.status).toBe(429);
   });

   it("answers every reset request but mails one address at most once a minute", async () => {
      const { post, signUp } = createTestAuth();
      await signUp("mail-victim@example.com");
      vi.mocked(sendAuthLinkEmail).mockClear();
      const sent = () =>
         vi
            .mocked(sendAuthLinkEmail)
            .mock.calls.filter(
               ([mail]) => mail.to === "mail-victim@example.com"
            ).length;
      const ask = (ip: string) =>
         post(
            "/request-password-reset",
            "",
            {
               email: "mail-victim@example.com",
               redirectTo: "http://localhost:3000/reset-password",
            },
            { [CLIENT_IP_HEADER]: ip }
         );
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      expect((await ask("198.51.100.80")).status).toBe(200);
      await vi.waitFor(() => expect(sent()).toBe(1));
      for (let ip = 81; ip < 86; ip++) {
         expect((await ask(`198.51.100.${ip}`)).status).toBe(200);
      }
      vi.mocked(Date.now).mockReturnValue(now + 61_000);
      expect((await ask("198.51.100.90")).status).toBe(200);
      await vi.waitFor(() => expect(sent()).toBe(2));
   });
});

describe("email verification", () => {
   const verify = async (
      auth: ReturnType<typeof createTestAuth>["auth"],
      email: string,
      cookie = ""
   ) => {
      const token = await createEmailVerificationToken(
         configured.options.secret!,
         email
      );
      return auth.handler(
         new Request(`http://localhost:5001/auth/verify-email?token=${token}`, {
            headers: { cookie },
         })
      );
   };

   it("leaves the verifier with the only session when someone pre-registered the address", async () => {
      const { auth, db, signUp } = createTestAuth();
      const attacker = await signUp("pre-hijack@example.com");
      const response = await verify(auth, "pre-hijack@example.com");
      expect(response.status).toBe(200);
      expect(db.user![0]!.emailVerified).toBe(true);
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie: attacker.cookie }),
         })
      ).toBeNull();
      const verifier = cookieOf(response);
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie: verifier }),
         })
      ).toMatchObject({ user: { email: "pre-hijack@example.com" } });
      expect(db.session).toHaveLength(1);
   });

   it("voids the squatter's password when a third party verifies the address", async () => {
      const { auth, db, signUp } = createTestAuth();
      await signUp("squatted@example.com");
      expect(db.account).toHaveLength(1);
      const response = await verify(auth, "squatted@example.com");
      expect(response.status).toBe(200);
      expect(db.account).toHaveLength(0);
      await expect(
         auth.api.signInEmail({
            body: { email: "squatted@example.com", password: PASSWORD },
         })
      ).rejects.toThrow();
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie: cookieOf(response) }),
         })
      ).toMatchObject({ user: { email: "squatted@example.com" } });
   });

   it("drops reset links outstanding when a third party verifies the address", async () => {
      const { auth, db, signUp } = createTestAuth();
      const { user } = await signUp("squatted-reset@example.com");
      db.verification!.push({
         id: "reset-row",
         identifier: "hashed-reset-token",
         value: user.id,
         expiresAt: new Date(Date.now() + 60_000),
      });
      await verify(auth, "squatted-reset@example.com");
      expect(db.verification!).toHaveLength(0);
   });

   it("keeps the verifier's own session when they verify while signed in", async () => {
      const { auth, db, signUp } = createTestAuth();
      const owner = await signUp("self-verify@example.com");
      const response = await verify(
         auth,
         "self-verify@example.com",
         owner.cookie
      );
      expect(response.status).toBe(200);
      expect(db.session).toHaveLength(1);
      expect(
         await auth.api.getSession({
            headers: new Headers({ cookie: owner.cookie }),
         })
      ).not.toBeNull();
   });

   it("keeps the password when the signing-up browser verifies", async () => {
      const { auth, db, signUp } = createTestAuth();
      const owner = await signUp("same-browser@example.com");
      await verify(auth, "same-browser@example.com", owner.cookie);
      expect(db.account).toHaveLength(1);
      await expect(
         auth.api.signInEmail({
            body: { email: "same-browser@example.com", password: PASSWORD },
         })
      ).resolves.toBeTruthy();
   });

   it("does not credit another user's session as the verifier's own", async () => {
      const { auth, db, signUp } = createTestAuth();
      const bystander = await signUp("bystander@example.com");
      await signUp("squatted-other@example.com");
      await verify(auth, "squatted-other@example.com", bystander.cookie);
      expect(
         db.account!.filter((account) => account.providerId === "credential")
      ).toHaveLength(1);
   });

   it("does not touch sessions when an already-used link is opened again", async () => {
      const { auth, db, signUp } = createTestAuth();
      await signUp("replayed@example.com");
      const owner = await verify(auth, "replayed@example.com");
      await auth.api.setPassword({
         body: { newPassword: PASSWORD },
         headers: new Headers({ cookie: cookieOf(owner) }),
      });
      await auth.api.signInEmail({
         body: { email: "replayed@example.com", password: PASSWORD },
      });
      expect(db.session).toHaveLength(2);
      expect((await verify(auth, "replayed@example.com")).status).toBe(200);
      expect(db.session).toHaveLength(2);
   });
});

describe("password changes", () => {
   const resetAuth = () => {
      const links: string[] = [];
      const testAuth = createTestAuth();
      const auth = betterAuth({
         ...testAuth.auth.options,
         emailAndPassword: {
            ...testAuth.auth.options.emailAndPassword,
            enabled: true,
            sendResetPassword: async ({ url }) => {
               links.push(new URL(url).pathname.split("/").at(-1)!);
            },
         },
      });
      const requestLink = (email: string) =>
         auth.api.requestPasswordReset({
            body: { email, redirectTo: "http://localhost:3000/reset-password" },
         });
      const reset = (token: string) =>
         auth.handler(
            new Request("http://localhost:5001/auth/reset-password", {
               method: "POST",
               headers: {
                  origin: "http://localhost:3000",
                  "content-type": "application/json",
               },
               body: JSON.stringify({
                  token,
                  newPassword: "a-brand-new-password-2026",
               }),
            })
         );
      return { ...testAuth, auth, links, requestLink, reset };
   };

   it("invalidates every other reset link once one is used", async () => {
      const { auth, links, requestLink, reset } = resetAuth();
      await auth.api.signUpEmail({
         body: { email: "siblings@example.com", password: PASSWORD, name: "S" },
      });
      await requestLink("siblings@example.com");
      await requestLink("siblings@example.com");
      expect(links).toHaveLength(2);
      expect((await reset(links[0]!)).status).toBe(200);
      const sibling = await reset(links[1]!);
      expect(sibling.status).toBe(400);
      expect(await sibling.json()).toMatchObject({ code: "INVALID_TOKEN" });
   });

   it("keeps outstanding reset links when the reset itself fails", async () => {
      const { auth, links, requestLink, reset } = resetAuth();
      await auth.api.signUpEmail({
         body: {
            email: "kept-link@example.com",
            password: PASSWORD,
            name: "K",
         },
      });
      await requestLink("kept-link@example.com");
      expect((await reset("not-a-real-token")).status).toBe(400);
      expect((await reset(links[0]!)).status).toBe(200);
   });

   it("drops outstanding reset links and other sessions on change-password, even if the caller opts out", async () => {
      const { auth, links, requestLink } = resetAuth();
      const signedUp = await auth.api.signUpEmail({
         body: { email: "change@example.com", password: PASSWORD, name: "C" },
         asResponse: true,
      });
      const first = cookieOf(signedUp);
      const second = cookieOf(
         await auth.api.signInEmail({
            body: { email: "change@example.com", password: PASSWORD },
            asResponse: true,
         })
      );
      await requestLink("change@example.com");
      const changed = await auth.handler(
         new Request("http://localhost:5001/auth/change-password", {
            method: "POST",
            headers: {
               cookie: first,
               origin: "http://localhost:3000",
               "content-type": "application/json",
            },
            body: JSON.stringify({
               currentPassword: PASSWORD,
               newPassword: "another-unique-password-2026",
               revokeOtherSessions: false,
            }),
         })
      );
      expect(changed.status).toBe(200);
      expect(
         await auth.api.getSession({ headers: new Headers({ cookie: second }) })
      ).toBeNull();
      await expect(
         auth.api.resetPassword({
            body: { token: links[0]!, newPassword: "a-third-password-2026" },
         })
      ).rejects.toMatchObject({ status: "BAD_REQUEST" });
   });
});

describe("deleting an account that owns shared servers", () => {
   it("refuses until the caller acknowledges the servers other members lose", async () => {
      const { db, signUp, post } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      const sharedServerNames = vi.fn(async () => ["Team <media>", "Ops"]);
      onUserDeletion({
         sharedServerNames,
         beforeDelete,
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("shared-owner@example.com");
      const confirmation = {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: PASSWORD,
      };
      const refused = await post("/delete-user", cookie, confirmation);
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({
         code: "SHARED_SERVERS_NOT_ACKNOWLEDGED",
         message: expect.stringContaining('"Team <media>", "Ops"'),
      });
      expect(sharedServerNames).toHaveBeenCalledWith(user.id);
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(db.user).toHaveLength(1);

      const accepted = await post("/delete-user", cookie, {
         ...confirmation,
         acknowledgeSharedServers: true,
      });
      expect(accepted.status).toBe(200);
      expect(beforeDelete).toHaveBeenCalledTimes(1);
      expect(db.user).toHaveLength(0);
   });

   it("needs no acknowledgement when nobody else uses the owned servers", async () => {
      const { db, signUp, post } = createTestAuth();
      onUserDeletion({
         sharedServerNames: noSharedServers,
         beforeDelete: async () => {},
         afterDelete: async () => {},
      });
      const { cookie, user } = await signUp("solo-owner@example.com");
      const response = await post("/delete-user", cookie, {
         expectedUserId: user.id,
         confirmedEmail: user.email,
         password: PASSWORD,
      });
      expect(response.status).toBe(200);
      expect(db.user).toHaveLength(0);
   });
});
