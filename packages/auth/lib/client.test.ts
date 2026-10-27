import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPECTED_USER_ID_HEADER } from "@s3-viewer/shared";
import { makeAuthClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

const setup = () => {
   let userId = "account-a";
   const fetch = vi.fn(async () => Response.json({ success: true }));
   vi.stubGlobal("fetch", fetch);
   const client = makeAuthClient({
      apiOrigin: "https://api.example.test",
      siteOrigin: "https://example.test",
      getExpectedUserId: () => userId,
   });
   return {
      client,
      fetch,
      switchAccount: () => {
         userId = "account-b";
      },
   };
};
const header = (call: unknown[] | undefined) =>
   new Headers((call?.[1] as RequestInit).headers).get(EXPECTED_USER_ID_HEADER);

describe("authenticated client actor binding", () => {
   it("captures password-change identity before the transport awaits", async () => {
      const { client, fetch, switchAccount } = setup();
      const pending = client.changePassword("old-password", "new-password");
      switchAccount();
      await pending;
      expect(header(fetch.mock.calls[0])).toBe("account-a");
   });

   it("uses explicit sign-out and deletion actors after the local session has changed", async () => {
      const { client, fetch, switchAccount } = setup();
      switchAccount();
      await client.signOut("account-a");
      expect(header(fetch.mock.calls[0])).toBe("account-a");
      await client.deleteAccount({
         expectedUserId: "account-a",
         confirmedEmail: "a@example.test",
         password: "password",
      });
      expect(header(fetch.mock.calls[1])).toBe("account-a");
   });

   it("binds profile and session calls to the account that asked", async () => {
      const { client, fetch, switchAccount } = setup();
      switchAccount();
      await client.updateProfileName("Name", "account-a");
      await client.revokeSession("session-token", "account-a");
      await client.revokeOtherSessions("account-a");
      fetch.mockResolvedValueOnce(Response.json([]));
      await expect(client.listSessions("account-a")).resolves.toEqual([]);
      expect(fetch.mock.calls.map(header)).toEqual([
         "account-a",
         "account-a",
         "account-a",
         "account-a",
      ]);
   });

   it("words session and profile refusals like every other auth error", async () => {
      const { client, fetch } = setup();
      const refusal = () =>
         Response.json(
            { code: "RATE_LIMITED", message: "raw" },
            { status: 429 }
         );
      fetch.mockImplementation(async () => refusal());
      const worded = "Too many attempts. Try again in a few minutes.";
      await expect(client.listSessions()).rejects.toThrow(worded);
      for (const result of await Promise.all([
         client.revokeSession("session-token"),
         client.revokeOtherSessions(),
         client.updateProfileName("Name"),
      ]))
         expect(result).toEqual({ error: worded, code: "RATE_LIMITED" });
   });

   it("binds the password lookup to the signed-in account", async () => {
      const { client, fetch } = setup();
      fetch.mockResolvedValueOnce(
         Response.json([{ providerId: "credential" }])
      );
      await expect(client.hasPassword()).resolves.toBe(true);
      expect(header(fetch.mock.calls[0])).toBe("account-a");
   });

   it("does not bind sign-in, sign-up or password recovery to the old account", async () => {
      const { client, fetch } = setup();
      await client.signInWithPassword("new@example.test", "password");
      // a refused sign-in makes continueWithPassword fall through to sign-up.
      fetch.mockResolvedValueOnce(
         Response.json(
            { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" },
            { status: 401 }
         )
      );
      await client.continueWithPassword("new@example.test", "password");
      await client.requestPasswordReset("new@example.test");
      await client.resetPassword("reset-token", "new-password");
      expect(fetch.mock.calls.map(header)).toEqual([
         null,
         null,
         null,
         null,
         null,
      ]);
   });
});

describe("requests the server never answers", () => {
   const UNREACHABLE = {
      error: "Couldn't reach the server. Check your connection and try again.",
      code: "NETWORK",
   };

   it("turns a failed fetch into a result instead of rejecting", async () => {
      const { client, fetch } = setup();
      fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const results = await Promise.all([
         client.signInWithPassword("a@example.test", "password"),
         client.requestPasswordReset("a@example.test"),
         client.resetPassword("reset-token", "new-password"),
         client.sendVerificationCode("a@example.test"),
         client.verifyEmailCode("a@example.test", "123456", "password"),
         client.changePassword("old-password", "new-password"),
         client.deleteAccount({
            expectedUserId: "account-a",
            confirmedEmail: "a@example.test",
            password: "password",
         }),
         client.signInWithGithub(),
         client.revokeSession("session-token"),
         client.revokeOtherSessions(),
         client.updateProfileName("Name"),
      ]);
      expect(results).toEqual(results.map(() => UNREACHABLE));
      await expect(
         client.continueWithPassword("a@example.test", "password")
      ).resolves.toEqual({ ...UNREACHABLE, created: false });
   });

   it("keeps rejecting where callers rely on a thrown error", async () => {
      const { client, fetch } = setup();
      fetch.mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(client.hasPassword()).rejects.toThrow();
      await expect(client.listSessions()).rejects.toThrow(UNREACHABLE.error);
      await expect(client.signOut()).rejects.toThrow();
   });
});

describe("continueWithPassword", () => {
   const answers = (...responses: [number, Record<string, unknown>][]) => {
      const { client, fetch } = setup();
      for (const [status, body] of responses) {
         fetch.mockResolvedValueOnce(Response.json(body, { status }));
      }
      return client;
   };
   const WRONG = [
      401,
      {
         code: "INVALID_EMAIL_OR_PASSWORD",
         message: "Invalid email or password",
      },
   ] as [number, Record<string, unknown>];

   const INVITE_ONLY = [
      403,
      {
         code: "SIGNUP_INVITE_REQUIRED",
         message:
            "Sign-ups are by invitation. Open the link in your invitation email to create your account.",
      },
   ] as [number, Record<string, unknown>];

   it("keeps the sign-in error for a refused sign-up that carried no invitation", async () => {
      const client = answers(WRONG, INVITE_ONLY);
      await expect(
         client.continueWithPassword("a@example.test", "password")
      ).resolves.toEqual({
         error: "Wrong email or password.",
         code: "INVALID_EMAIL_OR_PASSWORD",
         created: false,
      });
   });

   it("explains the policy when a sign-up from an invitation link is refused", async () => {
      const client = answers(WRONG, INVITE_ONLY);
      await expect(
         client.continueWithPassword("a@example.test", "password", {
            inviteId: "stale-invite-token",
         })
      ).resolves.toEqual({
         error: "Wrong email or password. Sign-ups are by invitation. Open the link in your invitation email to create your account.",
         code: "SIGNUP_INVITE_REQUIRED",
         created: false,
      });
   });

   it("keeps the sign-in error and flags the existing account for recovery", async () => {
      const client = answers(WRONG, [
         422,
         { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "exists" },
      ]);
      await expect(
         client.continueWithPassword("a@example.test", "password")
      ).resolves.toEqual({
         error: "Wrong email or password.",
         code: "INVALID_EMAIL_OR_PASSWORD",
         created: false,
         exists: true,
      });
   });

   it("stops at an unverified account without trying to create it again", async () => {
      const client = answers([
         403,
         { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
      ]);
      await expect(
         client.continueWithPassword("a@example.test", "password")
      ).resolves.toEqual({
         error: "Verify your email to continue.",
         code: "EMAIL_NOT_VERIFIED",
         created: false,
      });
   });

   it("reports a new account once the fallback sign-up succeeds", async () => {
      const client = answers(WRONG, [200, { user: { id: "new" } }]);
      await expect(
         client.continueWithPassword("a@example.test", "password")
      ).resolves.toEqual({ error: null, created: true });
   });
});
