import { publicEnv } from "@/lib/env";

const HOW_TO_SLUGS = [
   "bulk-delete-s3-files",
   "copy-files-between-s3-and-r2",
   "delete-file-from-s3",
   "download-file-from-s3",
   "invite-teammate-to-s3-bucket",
   "rename-s3-file",
   "search-across-s3-buckets",
   "secure-s3-upload-presigned-urls",
   "set-granular-s3-permissions",
   "share-s3-file-with-non-technical-user",
   "switch-between-s3-buckets",
   "upload-large-files-to-s3",
   "view-s3-and-r2-side-by-side",
] as const;

const USE_CASE_SLUGS = [
   "cloudflare-r2",
   "multi-cloud",
   "s3-browser",
   "security-and-audit",
   "share-with-non-technical-users",
   "teams",
] as const;

const LANDING_ROUTES: readonly string[] = [
   "/",
   "/about",
   "/brand-kit",
   "/legal",
   "/legal/terms-of-service",
   "/legal/privacy-policy",
   "/how-to",
   ...HOW_TO_SLUGS.map((s) => `/how-to/${s}`),
   "/use-cases",
   ...USE_CASE_SLUGS.map((s) => `/use-cases/${s}`),
];

const LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
   "/tos": "/legal/terms-of-service",
   "/terms": "/legal/terms-of-service",
   "/terms-of-service": "/legal/terms-of-service",
   "/terms-and-conditions": "/legal/terms-of-service",
   "/terms-conditions": "/legal/terms-of-service",
   "/privacy": "/legal/privacy-policy",
   "/privacy-policy": "/legal/privacy-policy",
   "/privacy-notice": "/legal/privacy-policy",
   "/use-cases/backups": "/use-cases/security-and-audit",
   "/use-cases/media": "/use-cases/s3-browser",
   "/use-cases/data-engineering": "/use-cases/s3-browser",
   "/use-cases/ai-ml": "/use-cases/s3-browser",
};

const TERMS_URL = `${publicEnv.siteOrigin}/legal/terms-of-service`;
const PRIVACY_URL = `${publicEnv.siteOrigin}/legal/privacy-policy`;
const SUPPORT_URL = "https://github.com/maydotinc/s3-viewer/issues";

export {
   LANDING_ROUTES,
   LEGACY_REDIRECTS,
   PRIVACY_URL,
   SUPPORT_URL,
   TERMS_URL,
};
