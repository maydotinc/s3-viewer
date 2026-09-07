import { GENERIC_ERROR_MESSAGE, PASSWORD_MIN_LENGTH } from "@s3-viewer/types";

type AuthClientError = {
   code?: string | undefined;
   status?: number | undefined;
   message?: string | undefined;
};

const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in a few minutes.";
const EXISTS = "An account with this email already exists. Sign in instead.";
const SIGN_UPS_CLOSED =
   "Sign-ups are disabled on this instance. Ask an administrator for access.";
const SIGN_UPS_BY_INVITE =
   "Sign-ups are by invitation. Use the address your invitation was sent to.";

// better auth error codes the ui gives its own words to; anything else falls
// back to the generic message so an internal detail never reaches the screen
const MESSAGES: Readonly<Record<string, string>> = {
   INVALID_EMAIL_OR_PASSWORD: "Wrong email or password.",
   INVALID_PASSWORD: "That isn't your current password.",
   USER_ALREADY_EXISTS: EXISTS,
   USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: EXISTS,
   PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
   PASSWORD_TOO_LONG: "That password is too long.",
   CREDENTIAL_ACCOUNT_NOT_FOUND: "This account has no password yet.",
   INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
   TOKEN_EXPIRED: "That link has expired. Request a new one.",
   EMAIL_ALREADY_VERIFIED: "This email is already verified.",
   RATE_LIMITED: TOO_MANY_ATTEMPTS,
   ACCOUNT_CHANGED:
      "Your account changed. Reopen the deletion dialog and confirm again.",
   ACCOUNT_CONFIRMATION_REQUIRED:
      "Confirm your account email before deleting your account.",
   EMAIL_PASSWORD_SIGN_UP_DISABLED: SIGN_UPS_CLOSED,
   PASSWORD_NOT_SET: "Set a password in Settings before deleting your account.",
};

// the sign-up policy's refusals name this instance's own domains, so the
// server's wording is the only accurate one; every other code keeps using the
// table above so an internal detail never reaches the screen
const SERVER_WORDED = new Set(["SIGNUP_DISABLED", "SIGNUP_INVITE_REQUIRED"]);

const authErrorMessage = (error: AuthClientError): string => {
   if (error.code && SERVER_WORDED.has(error.code) && error.message) {
      return error.message;
   }
   if (error.code && Object.hasOwn(MESSAGES, error.code)) {
      return MESSAGES[error.code] ?? GENERIC_ERROR_MESSAGE;
   }
   if (error.status === 429) return TOO_MANY_ATTEMPTS;
   return GENERIC_ERROR_MESSAGE;
};

export { authErrorMessage, SIGN_UPS_BY_INVITE, SIGN_UPS_CLOSED };
export type { AuthClientError };
