import { GENERIC_ERROR_MESSAGE, PASSWORD_MIN_LENGTH } from "@s3-viewer/types";

type AuthClientError = {
   code?: string | undefined;
   status?: number | undefined;
   message?: string | undefined;
};

const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in a few minutes.";

// better auth error codes the ui gives its own words to; anything else falls
// back to the generic message so an internal detail never reaches the screen
const MESSAGES: Readonly<Record<string, string>> = {
   INVALID_OTP: "That code isn't right. Check it and try again.",
   OTP_EXPIRED: "That code has expired. Request a new one.",
   TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code.",
   INVALID_EMAIL_OR_PASSWORD: "Wrong email or password.",
   INVALID_PASSWORD: "That isn't your current password.",
   USER_ALREADY_EXISTS:
      "An account with this email already exists. Sign in instead.",
   USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
      "An account with this email already exists. Sign in instead.",
   PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
   PASSWORD_TOO_LONG: "That password is too long.",
   CREDENTIAL_ACCOUNT_NOT_FOUND: "This account has no password yet.",
   RATE_LIMITED: TOO_MANY_ATTEMPTS,
};

const authErrorMessage = (error: AuthClientError): string => {
   if (error.code && Object.hasOwn(MESSAGES, error.code)) {
      return MESSAGES[error.code] ?? GENERIC_ERROR_MESSAGE;
   }
   if (error.status === 429) return TOO_MANY_ATTEMPTS;
   return GENERIC_ERROR_MESSAGE;
};

export { authErrorMessage };
export type { AuthClientError };
