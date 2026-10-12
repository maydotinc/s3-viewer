import { describe, expect, it } from "vitest";
import { loginNotice } from "./login-notice";

describe("the notice above the login form", () => {
   it("explains a GitHub sign-in refused for an unverified email", () => {
      expect(loginNotice({ error: "PROVIDER_EMAIL_UNVERIFIED" })).toBe(
         "GitHub hasn't verified that email address yet. Verify it with GitHub, then sign in again."
      );
   });

   it("never shows the error description a link carries", () => {
      const notice = loginNotice({
         error: "PROVIDER_EMAIL_UNVERIFIED",
         error_description: "Call +1 555 0100 to unlock your account",
      } as Parameters<typeof loginNotice>[0]);
      expect(notice).not.toContain("555");
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
