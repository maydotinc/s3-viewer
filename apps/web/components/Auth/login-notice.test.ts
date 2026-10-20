import { SIGN_UPS_CLOSED } from "@s3-viewer/auth/client";
import { describe, expect, it } from "vitest";
import { loginNotice } from "./login-notice";

describe("the notice above the login form", () => {
   it("explains GitHub sign-ins that retrying can't fix", () => {
      expect(loginNotice({ error: "PROVIDER_EMAIL_UNVERIFIED" })).toBe(
         "GitHub hasn't verified that email address yet. Verify it with GitHub, then sign in again."
      );
      expect(loginNotice({ error: "SIGNUP_INVITE_REQUIRED" })).toBe(
         "This email can't create an account here. Open the link in your invitation email, or use an allowed address."
      );
      expect(loginNotice({ error: "SIGNUP_DISABLED" })).toBe(SIGN_UPS_CLOSED);
      expect(loginNotice({ error: "signup_disabled" })).toBe(SIGN_UPS_CLOSED);
      expect(loginNotice({ error: "account_not_linked" })).toBe(
         "An account with this email already exists. Log in with its password, or reset the password to reclaim it."
      );
   });

   it("falls back to the generic message for other errors", () => {
      expect(loginNotice({ error: "access_denied" })).toBe(
         "Login didn't complete. Try again."
      );
      expect(loginNotice({ error: "constructor" })).toBe(
         "Login didn't complete. Try again."
      );
   });

   it("shows the notice for a known reason and nothing for an unknown one", () => {
      expect(loginNotice({ reason: "reset" })).toBe(
         "Password updated. Log in with your new password."
      );
      expect(loginNotice({ reason: "expired" })).toBe(
         "Your session has ended. Log in again to continue."
      );
      expect(loginNotice({ reason: "toString" })).toBeNull();
      expect(loginNotice({ reason: "nope", error: "x" })).toBeNull();
   });

   it("ignores repeated parameters", () => {
      expect(loginNotice({ error: ["a", "b"] })).toBeNull();
      expect(loginNotice({})).toBeNull();
   });
});
