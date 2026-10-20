import { AuthErrorCode, SIGN_UPS_CLOSED } from "@s3-viewer/auth/client";

const FAILED = "Login didn't complete. Try again.";

const REASON_NOTICES: Readonly<Record<string, string>> = {
   reset: "Password updated. Log in with your new password.",
   failed: FAILED,
   expired: "Your session has ended. Log in again to continue.",
};

const ERROR_NOTICES: Readonly<Record<string, string>> = {
   [AuthErrorCode.PROVIDER_EMAIL_UNVERIFIED]:
      "GitHub hasn't verified that email address yet. Verify it with GitHub, then sign in again.",
   [AuthErrorCode.SIGNUP_INVITE_REQUIRED]:
      "This email can't create an account here. Open the link in your invitation email, or use an allowed address.",
   [AuthErrorCode.SIGNUP_DISABLED]: SIGN_UPS_CLOSED,
   signup_disabled: SIGN_UPS_CLOSED,
   account_not_linked:
      "An account with this email already exists. Log in with its password, or reset the password to reclaim it.",
};

const lookup = (notices: Readonly<Record<string, string>>, key: string) =>
   Object.hasOwn(notices, key) ? (notices[key] ?? null) : null;

const loginNotice = (query: {
   reason?: string | string[];
   error?: string | string[];
}): string | null => {
   if (typeof query.reason === "string")
      return lookup(REASON_NOTICES, query.reason);
   if (typeof query.error === "string")
      return lookup(ERROR_NOTICES, query.error) ?? FAILED;
   return null;
};

export { loginNotice };
