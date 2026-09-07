import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import {
   DAY_MS,
   SESSION_ABSOLUTE_TTL_DAYS,
   type AuditEntry,
   type SignUpMode,
} from "@s3-viewer/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the policy is read at call time by the database hook, so tests reassign the
// fields of this object rather than re-importing the module
const { policy, invitedAddresses } = vi.hoisted(() => ({
   policy: {
      mode: "open" as SignUpMode,
      allowedEmailDomains: [] as string[],
   },
   invitedAddresses: new Set<string>(),
}));

// the invite lookup is the only query packages/auth makes on its own; the set
// stands in for the rows a live `pendingInvitation` would return
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      pendingInvitation: {
         count: async ({ where }: { where: { email: string } }) =>
            invitedAddresses.has(where.email) ? 1 : 0,
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

import { auth as configured, onAuthEvent, onUserDeletion } from "./auth";

const PASSWORD = "unique-test-password-2026";

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
   policy.mode = "open";
   policy.allowedEmailDomains = [];
   invitedAddresses.clear();
   onAuthEvent(async () => {});
});

// the audit handler is fire-and-forget, so a test has to let the microtask
// queue drain before it can see what an endpoint emitted
const collectAuthEvents = (): AuditEntry[] => {
   const entries: AuditEntry[] = [];
   onAuthEvent(async (entry) => {
      entries.push(entry);
   });
   return entries;
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

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
   const rawSignUp = (email: string) =>
      post("/sign-up/email", "", { email, password: PASSWORD, name: "New" });
   return { auth, db, post, rawSignUp, signUp };
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
         password: PASSWORD,
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

describe("sign-up policy", () => {
   // this instance was built while the policy was still open, so what refuses
   // here is the database hook rather than emailAndPassword.disableSignUp;
   // env.test.ts covers the option the policy feeds at boot
   it("refuses every sign-up when the instance is closed", async () => {
      policy.mode = "closed";
      const { db, rawSignUp } = createTestAuth();
      const events = collectAuthEvents();
      const response = await rawSignUp("Closed@Example.com");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
         code: "SIGNUP_DISABLED",
         message:
            "Sign-ups are disabled on this instance. Ask an administrator for access.",
      });
      expect(db.user).toHaveLength(0);
      await settled();
      expect(events).toEqual([
         { action: "auth.sign_up_refused", target: "closed@example.com" },
      ]);
   });

   it("refuses an unlisted domain and records the address it turned away", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com", "acme.dev"];
      const { db, rawSignUp } = createTestAuth();
      const events = collectAuthEvents();
      const response = await rawSignUp("Outsider@Other.COM");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
         code: "SIGNUP_INVITE_REQUIRED",
         message:
            "Sign-ups are limited to @acme.com and @acme.dev addresses, or to invited addresses.",
      });
      expect(db.user).toHaveLength(0);
      await settled();
      expect(events).toEqual([
         { action: "auth.sign_up_refused", target: "outsider@other.com" },
      ]);
   });

   it("accepts a listed domain", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com"];
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("worker@acme.com")).status).toBe(200);
      expect(db.user).toHaveLength(1);
   });

   // an admin can invite any address; refusing it at sign-up would leave the
   // invitation unacceptable, because accepting one needs an account
   it("accepts an off-domain address that holds a live invitation", async () => {
      policy.mode = "domains";
      policy.allowedEmailDomains = ["acme.com"];
      invitedAddresses.add("guest@other.com");
      const { db, rawSignUp } = createTestAuth();
      expect((await rawSignUp("Guest@Other.com")).status).toBe(200);
      expect(db.user).toHaveLength(1);
   });

   it("refuses an uninvited address in `invite` mode and accepts an invited one", async () => {
      policy.mode = "invite";
      invitedAddresses.add("invited@example.com");
      const { db, rawSignUp } = createTestAuth();
      const refused = await rawSignUp("stranger@example.com");
      expect(refused.status).toBe(403);
      expect(await refused.json()).toMatchObject({
         code: "SIGNUP_INVITE_REQUIRED",
         message:
            "Sign-ups are by invitation. Use the address your invitation was sent to.",
      });
      expect((await rawSignUp("Invited@Example.com")).status).toBe(200);
      expect(db.user).toHaveLength(1);
   });

   // `closed` means closed: an invitation cannot reopen the instance
   it("ignores an invitation when the instance is closed", async () => {
      policy.mode = "closed";
      invitedAddresses.add("invited@example.com");
      const { db, rawSignUp } = createTestAuth();
      const response = await rawSignUp("invited@example.com");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "SIGNUP_DISABLED" });
      expect(db.user).toHaveLength(0);
   });

   // disableSignUp closes better auth's own endpoint; the database hook is the
   // backstop for any other path that would create a user row
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

describe("auth audit events", () => {
   it("records a sign-up, a sign-in, a failed sign-in and a sign-out", async () => {
      const { auth, post, rawSignUp } = createTestAuth();
      const events = collectAuthEvents();
      const created = await rawSignUp("events@example.com");
      const cookie = created.headers
         .getSetCookie()
         .map((value) => value.split(";")[0])
         .join("; ");
      const { user } = await created.json();
      expect(
         (
            await auth.api.signInEmail({
               body: { email: user.email, password: PASSWORD },
               asResponse: true,
            })
         ).status
      ).toBe(200);
      expect(
         (
            await post("/sign-in/email", "", {
               email: " Events@Example.com ",
               password: "not-the-password",
            })
         ).status
      ).toBe(400);
      expect((await post("/sign-out", cookie, {})).status).toBe(200);
      await settled();
      expect(events).toEqual([
         {
            action: "auth.sign_up",
            actorId: user.id,
            target: "events@example.com",
         },
         { action: "auth.sign_in", actorId: user.id, target: "password" },
         {
            action: "auth.sign_in_failed",
            actorId: user.id,
            target: "password",
         },
         { action: "auth.sign_out", actorId: user.id, target: null },
      ]);
   });

   // a raw address in `target` would be unreadable pii: nothing can show a row
   // for an account that does not exist, so nothing is written for one
   it("writes nothing for a failed sign-in against an unknown address", async () => {
      const { post } = createTestAuth();
      const events = collectAuthEvents();
      expect(
         (
            await post("/sign-in/email", "", {
               email: "nobody@example.com",
               password: "not-the-password",
            })
         ).status
      ).toBe(401);
      await settled();
      expect(events).toEqual([]);
   });

   it("records a password change and a session revocation", async () => {
      const { post, signUp } = createTestAuth();
      const { cookie, user } = await signUp("events-session@example.com");
      const events = collectAuthEvents();
      expect(
         (
            await post("/change-password", cookie, {
               currentPassword: PASSWORD,
               newPassword: "another-unique-password-2026",
            })
         ).status
      ).toBe(200);
      expect((await post("/revoke-other-sessions", cookie, {})).status).toBe(
         200
      );
      await settled();
      expect(events).toEqual([
         { action: "auth.password_change", actorId: user.id, target: null },
         { action: "auth.sessions_revoked", actorId: user.id, target: null },
      ]);
   });

   it("never fails an auth request because the audit handler threw", async () => {
      const { post, signUp } = createTestAuth();
      const { cookie } = await signUp("events-throw@example.com");
      onAuthEvent(async () => {
         throw new Error("audit store is down");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect((await post("/sign-out", cookie, {})).status).toBe(200);
      await settled();
   });
});

describe("password-confirmed deletion", () => {
   it("refuses a wrong password and deletes on the right one", async () => {
      const { db, post, signUp } = createTestAuth();
      const beforeDelete = vi.fn(async () => {});
      onUserDeletion({ beforeDelete, afterDelete: async () => {} });
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
      onUserDeletion({ beforeDelete, afterDelete: async () => {} });
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
      const events = collectAuthEvents();
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
      await settled();
      expect(events.map((entry) => entry.action)).toContain(
         "auth.password_reset"
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

   // the provider reads api.github.com through better-fetch, which uses the
   // global fetch: stubbing it exercises the real composition of `verified`
   // and mapProfileToUser instead of asserting the option in isolation
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
      // the avatar is the one thing the map still overrides
      expect(info?.user.image).toBeUndefined();
   });

   it("passes a github-verified address through as verified", async () => {
      stubGithubApi([{ email: PROFILE.email, verified: true }]);
      const provider = await githubProvider();
      const info = await provider.getUserInfo!({ accessToken: "token" });
      expect(info?.user.emailVerified).toBe(true);
   });

   // github.mjs spreads the map after its own `verified` lookup, so any
   // emailVerified here would silently replace the provider's answer
   it("maps nothing but the avatar", async () => {
      // the map takes no profile argument any more, which is the point: there
      // is nothing left in it that could depend on what github sent
      const map = configured.options.socialProviders?.github?.mapProfileToUser;
      const mapped = await map?.();
      expect(mapped).toEqual({ image: undefined });
      expect(Object.hasOwn(mapped ?? {}, "emailVerified")).toBe(false);
   });

   // trusting a provider skips link-account.mjs:83's check that the provider
   // itself called the address verified, which is the takeover path
   it("trusts no provider for account linking", () => {
      expect(configured.options.account?.accountLinking).toEqual({
         enabled: true,
         requireLocalEmailVerified: true,
      });
   });

   it("leaves the provider open outside `closed` mode", () => {
      expect(configured.options.socialProviders?.github?.disableSignUp).toBe(
         false
      );
   });
});
