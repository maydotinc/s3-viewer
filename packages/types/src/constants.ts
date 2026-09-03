export const PRODUCT_NAME = "S3 Viewer";

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export const AUTH_BASE_PATH = "/auth";
export const AUTH_CODE_LENGTH = 6;
export const AUTH_CODE_TTL_MINUTES = 10;
export const SESSION_TTL_DAYS = 30;

export const SITE_PATHS = {
   dashboard: "/dashboard",
   login: "/login",
   signup: "/signup",
   verify: "/verify",
   settings: "/settings",
   settingsProfile: "/settings/profile",
   settingsInvites: "/settings/invites",
   buckets: "/buckets",
} as const;

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const ErrorCode = {
   VALIDATION: "VALIDATION",
   RATE_LIMITED: "RATE_LIMITED",
   EMAIL_UNVERIFIED: "EMAIL_UNVERIFIED",
   ORIGIN: "ORIGIN",
   CREDENTIALS_UNREADABLE: "CREDENTIALS_UNREADABLE",
   CREDENTIALS_REJECTED: "CREDENTIALS_REJECTED",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const isCredentialsErrorCode = (code: string | undefined): boolean =>
   code === ErrorCode.CREDENTIALS_UNREADABLE ||
   code === ErrorCode.CREDENTIALS_REJECTED;

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const PRESIGN_EXPIRY_SECONDS = 15 * 60;

export const S3_MAX_KEYS_PER_REQUEST = 1000;
export const MAX_LIST_BLOCK_SIZE = S3_MAX_KEYS_PER_REQUEST;
export const MAX_BATCH_KEYS = S3_MAX_KEYS_PER_REQUEST;
export const MAX_BATCH_KEY_CHARS = 256 * 1024;
export const MAX_RENAME_BYTES = 5 * 1024 ** 3;

export const MAX_INVITE_EMAILS = 5;
export const MAX_PENDING_INVITES = 30;
export const INVITE_TTL_DAYS = 7;
