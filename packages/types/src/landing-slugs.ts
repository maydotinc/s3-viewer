export const HOW_TO_SLUGS = [
   "abort-incomplete-multipart-uploads-s3",
   "bulk-delete-s3-files",
   "bulk-rename-s3-files",
   "copy-files-between-s3-and-r2",
   "create-folder-in-s3",
   "delete-file-from-s3",
   "download-file-from-s3",
   "download-s3-folder-as-zip",
   "edit-file-in-s3",
   "edit-s3-object-metadata",
   "fix-s3-access-denied",
   "iam-user-read-only-one-s3-bucket",
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

export const USE_CASE_SLUGS = [
   "cloudflare-r2",
   "multi-cloud",
   "s3-browser",
   "security-and-audit",
   "share-with-non-technical-users",
   "teams",
] as const;

export type HowToSlug = (typeof HOW_TO_SLUGS)[number];
export type UseCaseSlug = (typeof USE_CASE_SLUGS)[number];
