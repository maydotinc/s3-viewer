export const PRODUCT_NAME = "S3 Viewer";
export const COMPANY_NAME = "May Inc.";
export const COMPANY_URL = "https://may.inc";

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const AUTH_BASE_PATH = "/auth";
export const EXPECTED_USER_ID_HEADER = "X-Expected-User-Id";
export const ACCOUNT_CHANGED_MESSAGE =
   "Your account changed. Refresh the page and try again.";
export const REQUEST_ID_HEADER = "X-Request-Id";
export const CLIENT_IP_HEADER = "X-Client-Ip";
export const INVITE_QUERY_PARAM = "invite";
export const INVITE_TOKEN_HEADER = "X-Invite-Token";
export const API_CONTRACT_VERSION = 5;
export const OBJECT_MUTATION_PATH = "/v3";
export const MULTIPART_UPLOADS_PATH = `${OBJECT_MUTATION_PATH}/multipart-uploads`;
export const MULTIPART_PARTS_PATH = `${MULTIPART_UPLOADS_PATH}/parts`;
export const MULTIPART_COMPLETE_PATH = `${MULTIPART_UPLOADS_PATH}/complete`;
export const MULTIPART_ABORT_PATH = `${MULTIPART_UPLOADS_PATH}/upload`;
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
export const MULTIPART_PART_CONTENT_TYPE = DEFAULT_CONTENT_TYPE;
export const AUTH_LINK_TTL_HOURS = 1;
export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_TTL_MINUTES = 10;
export const VERIFICATION_CODE_ATTEMPTS = 5;
export const VERIFICATION_CODE_RESEND_SECONDS = 60;
export const MAX_EMAIL_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const SESSION_TTL_DAYS = 30;
export const SESSION_ABSOLUTE_TTL_DAYS = 90;
export const SESSION_FRESH_HOURS = 24;

export const GITHUB_ISSUES_URL =
   "https://github.com/maydotinc/s3-viewer/issues";

export const SITE_PATHS = {
   dashboard: "/dashboard",
   login: "/login",
   signup: "/signup",
   forgotPassword: "/forgot-password",
   resetPassword: "/reset-password",
   settingsProfile: "/settings/profile",
   settingsInvites: "/settings/invites",
   buckets: "/buckets",
} as const;

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const ErrorCode = {
   VALIDATION: "VALIDATION",
   ACCOUNT_CHANGED: "ACCOUNT_CHANGED",
   RATE_LIMITED: "RATE_LIMITED",
   TRANSFER_NOT_STARTED: "TRANSFER_NOT_STARTED",
   EMAIL_UNVERIFIED: "EMAIL_UNVERIFIED",
   SESSION_STALE: "SESSION_STALE",
   AUDIT_UNAVAILABLE: "AUDIT_UNAVAILABLE",
   ORIGIN: "ORIGIN",
   CREDENTIALS_UNREADABLE: "CREDENTIALS_UNREADABLE",
   CREDENTIALS_REJECTED: "CREDENTIALS_REJECTED",
   FOLDER_ACCESS: "FOLDER_ACCESS",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const isCredentialsErrorCode = (code: string | undefined): boolean =>
   code === ErrorCode.CREDENTIALS_UNREADABLE ||
   code === ErrorCode.CREDENTIALS_REJECTED;

export const PRESIGN_EXPIRY_SECONDS = 15 * 60;

export const S3_MAX_KEYS_PER_REQUEST = 1000;
export const MAX_LIST_BLOCK_SIZE = S3_MAX_KEYS_PER_REQUEST;
export const MAX_BATCH_KEYS = S3_MAX_KEYS_PER_REQUEST;

export const MAX_MOVE_KEYS = 250;
export const MAX_BATCH_KEY_CHARS = 256 * 1024;
export const MAX_VALIDATE_BUCKETS = 20;

export const ARCHIVE_TOKEN_MAX_CHARS = 4096;

export const MIB = 1024 * 1024;
export const GIB = 1024 * MIB;
const TIB = 1024 * GIB;

export const MAX_MULTIPART_PARTS = 10_000;
export const MAX_OBJECT_BYTES = 5 * TIB;

export const MULTIPART_THRESHOLD_BYTES = 64 * MIB;

export const MULTIPART_CONCURRENCY = 3;

export const MAX_SERVERS_PER_USER = 20;
export const MAX_INVITE_EMAILS = 5;
export const MAX_PENDING_INVITES = 30;
export const INVITE_TTL_DAYS = 7;
export const INVITE_EMAIL_COOLDOWN_MS = 15 * MINUTE_MS;
export const INVITE_EMAILS_PER_RECIPIENT_PER_DAY = 3;
export const INVITE_EMAILS_PER_SERVER_PER_DAY = 50;
