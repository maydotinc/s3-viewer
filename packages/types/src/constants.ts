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
   invites: "/invites",
   buckets: "/buckets",
} as const;

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const PRESIGN_EXPIRY_SECONDS = 15 * 60;

export const S3_MAX_KEYS_PER_REQUEST = 1000;
export const MAX_LIST_BLOCK_SIZE = S3_MAX_KEYS_PER_REQUEST;
export const MAX_DELETE_KEYS = S3_MAX_KEYS_PER_REQUEST;
export const MAX_RENAME_BYTES = 5 * 1024 ** 3;

export const MAX_INVITE_EMAILS = 5;
export const INVITE_TTL_DAYS = 7;
