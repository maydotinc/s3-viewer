import {
   ACCOUNT_CHANGED_MESSAGE,
   ErrorCode,
   GENERIC_ERROR_MESSAGE,
   PASSWORD_MIN_LENGTH,
   PROFILE_NAME_MAX,
} from "@s3-viewer/shared";

const AuthErrorCode = {
   ACCOUNT_CONFIRMATION_REQUIRED: "ACCOUNT_CONFIRMATION_REQUIRED",
   EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
   INVALID_EMAIL_OR_PASSWORD: "INVALID_EMAIL_OR_PASSWORD",
   NETWORK: "NETWORK",
   PASSWORD_NOT_SET: "PASSWORD_NOT_SET",
   PROVIDER_EMAIL_UNVERIFIED: "PROVIDER_EMAIL_UNVERIFIED",
   RATE_LIMITED: ErrorCode.RATE_LIMITED,
   SESSION_EXPIRED: "SESSION_EXPIRED",
   SHARED_SERVERS_NOT_ACKNOWLEDGED: "SHARED_SERVERS_NOT_ACKNOWLEDGED",
   SIGNUP_DISABLED: "SIGNUP_DISABLED",
   SIGNUP_INVITE_REQUIRED: "SIGNUP_INVITE_REQUIRED",
   VERIFICATION_LOCKED: "VERIFICATION_LOCKED",
} as const;
type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

type AuthClientError = {
   code?: string | undefined;
   status?: number | undefined;
   message?: string | undefined;
};

const TOO_MANY_ATTEMPTS = "Too many attempts. Try again in a few minutes.";
// a reset link proves the inbox too, so it verifies the address without a code.
const TOO_MANY_CODE_GUESSES =
   "Too many wrong codes. Try again later, or reset your password to verify this email.";
const EXISTS = "An account with this email already exists. Sign in instead.";
const SIGN_UPS_CLOSED =
   "Sign-ups are disabled on this instance. Ask an administrator for access.";
const SIGN_UPS_BY_INVITE =
   "Sign-ups are by invitation. Open the link in your invitation email to create your account.";
const PASSWORD_NOT_SET_MESSAGE =
   "Set a password in Settings before deleting your account.";
const INVALID_EMAIL_MESSAGE = "Enter a valid email address.";
const INVALID_NAME_MESSAGE = `Enter a name of up to ${PROFILE_NAME_MAX} characters.`;

const MESSAGES: Readonly<Record<string, string>> = {
   [AuthErrorCode.INVALID_EMAIL_OR_PASSWORD]: "Wrong email or password.",
   INVALID_PASSWORD: "That isn't your current password.",
   USER_ALREADY_EXISTS: EXISTS,
   USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: EXISTS,
   PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
   PASSWORD_TOO_LONG: "That password is too long.",
   CREDENTIAL_ACCOUNT_NOT_FOUND: "This account has no password yet.",
   INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
   TOKEN_EXPIRED: "That link has expired. Request a new one.",
   [AuthErrorCode.EMAIL_NOT_VERIFIED]: "Verify your email to continue.",
   INVALID_OTP: "That code isn't right. Check it and try again.",
   OTP_EXPIRED: "That code has expired. Resend to get a new one.",
   TOO_MANY_ATTEMPTS: "Too many tries. Resend to get a new code.",
   [AuthErrorCode.RATE_LIMITED]: TOO_MANY_ATTEMPTS,
   [AuthErrorCode.VERIFICATION_LOCKED]: TOO_MANY_CODE_GUESSES,
   [ErrorCode.ACCOUNT_CHANGED]: ACCOUNT_CHANGED_MESSAGE,
   [AuthErrorCode.ACCOUNT_CONFIRMATION_REQUIRED]:
      "Confirm your account email before deleting your account.",
   EMAIL_PASSWORD_SIGN_UP_DISABLED: SIGN_UPS_CLOSED,
   [AuthErrorCode.PASSWORD_NOT_SET]: PASSWORD_NOT_SET_MESSAGE,
};

const SERVER_WORDED: ReadonlySet<string> = new Set([
   AuthErrorCode.SIGNUP_DISABLED,
   AuthErrorCode.SIGNUP_INVITE_REQUIRED,
   AuthErrorCode.SHARED_SERVERS_NOT_ACKNOWLEDGED,
]);

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

export {
   AuthErrorCode,
   authErrorMessage,
   EXISTS,
   INVALID_EMAIL_MESSAGE,
   INVALID_NAME_MESSAGE,
   PASSWORD_NOT_SET_MESSAGE,
   SIGN_UPS_BY_INVITE,
   SIGN_UPS_CLOSED,
   TOO_MANY_ATTEMPTS,
   TOO_MANY_CODE_GUESSES,
};
export type { AuthClientError };
