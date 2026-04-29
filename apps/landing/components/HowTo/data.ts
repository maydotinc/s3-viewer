export type HowToCategory = "Files" | "Sharing" | "Multi-cloud" | "Permissions";

export type HowToEntry = {
   slug: string;
   title: string;
   shortTitle: string;
   tagline: string;
   keyword: string;
   category: HowToCategory;
};

export const HOW_TOS: HowToEntry[] = [
   {
      slug: "rename-s3-file",
      title: "How to rename a file in S3",
      shortTitle: "Rename an S3 file",
      tagline:
         "Amazon S3 has no rename API — keys are immutable. Here's the standard copy + delete pattern, with metadata and tags preserved.",
      keyword: "rename file in S3",
      category: "Files",
   },
   {
      slug: "share-s3-file-with-non-technical-user",
      title: "How to share an S3 file with a non-technical user",
      shortTitle: "Share an S3 file",
      tagline:
         "Presigned URL or workspace invite — when each is the right call, and why presigned links can't be revoked.",
      keyword: "share S3 file with non-technical user",
      category: "Sharing",
   },
   {
      slug: "invite-teammate-to-s3-bucket",
      title: "How to invite a teammate to your S3 bucket",
      shortTitle: "Invite a teammate",
      tagline:
         "Skip per-person IAM users for human collaboration. Email invite, per-bucket role, one-click revoke.",
      keyword: "invite teammate to S3 bucket",
      category: "Sharing",
   },
   {
      slug: "view-s3-and-r2-side-by-side",
      title: "How to view AWS S3 and Cloudflare R2 in one dashboard",
      shortTitle: "View S3 + R2 together",
      tagline:
         "One credential per provider, one sidebar, Cmd-K to jump, and right-click to copy across clouds.",
      keyword: "view S3 and R2 together",
      category: "Multi-cloud",
   },
   {
      slug: "copy-files-between-s3-and-r2",
      title: "How to copy files between AWS S3 and Cloudflare R2",
      shortTitle: "Copy S3 ↔ R2",
      tagline:
         "Server-side cross-cloud copy without downloading locally — one click in S3 Viewer, AWS CLI, or rclone for bulk.",
      keyword: "copy files from S3 to Cloudflare R2",
      category: "Multi-cloud",
   },
   {
      slug: "switch-between-s3-buckets",
      title: "How to switch between S3 buckets quickly",
      shortTitle: "Switch buckets fast",
      tagline:
         "Cmd-K fuzzy switcher across every connected provider, plus AWS CLI named profiles for scripts.",
      keyword: "switch between S3 buckets",
      category: "Multi-cloud",
   },
   {
      slug: "upload-large-files-to-s3",
      title: "How to upload large files to S3",
      shortTitle: "Upload large files",
      tagline:
         "Multipart upload — part sizes, parallelism, retries, and the 5 GB single-PUT cap that pushes you to multipart.",
      keyword: "upload large files to S3",
      category: "Files",
   },
   {
      slug: "secure-s3-upload-presigned-urls",
      title: "How to upload to S3 securely with presigned URLs",
      shortTitle: "Secure S3 upload",
      tagline:
         "Never ship AWS keys to the browser. Server-signed presigned URLs let the browser PUT directly without the credential.",
      keyword: "S3 upload without exposing keys",
      category: "Files",
   },
   {
      slug: "download-file-from-s3",
      title: "How to download a file from S3",
      shortTitle: "Download a file",
      tagline:
         "Browser, AWS CLI, or presigned URL — three ways, with auto-inferred filenames and zero key exposure.",
      keyword: "download file from S3",
      category: "Files",
   },
   {
      slug: "set-granular-s3-permissions",
      title: "How to set granular S3 permissions per prefix",
      shortTitle: "Granular permissions",
      tagline:
         "The IAM s3:prefix Condition that everyone misses, plus when workspace roles are simpler than IAM.",
      keyword: "S3 permissions per prefix",
      category: "Permissions",
   },
   {
      slug: "search-across-s3-buckets",
      title: "How to search across S3 buckets",
      shortTitle: "Search across buckets",
      tagline:
         "How to actually search S3 with Tab autocomplete, and when S3 Inventory + Athena is the right pattern.",
      keyword: "search S3 buckets",
      category: "Files",
   },
   {
      slug: "delete-file-from-s3",
      title: "How to delete a file from S3 safely",
      shortTitle: "Delete a file",
      tagline:
         "Versioning, delete markers, MFA Delete — and how to actually purge instead of soft-deleting.",
      keyword: "delete file from S3",
      category: "Files",
   },
   {
      slug: "bulk-delete-s3-files",
      title: "How to bulk-delete S3 files",
      shortTitle: "Bulk-delete files",
      tagline:
         "DeleteObjects API explained — up to 1,000 keys per request, and how versioning changes the answer.",
      keyword: "bulk delete S3 files",
      category: "Files",
   },
];

export const getHowToByslug = (slug: string) =>
   HOW_TOS.find((h) => h.slug === slug);

export const getRelatedHowTos = (
   slugs: string[]
): { href: string; title: string; description: string }[] =>
   slugs
      .map((s) => HOW_TOS.find((h) => h.slug === s))
      .filter((h): h is HowToEntry => Boolean(h))
      .map((h) => ({
         href: `/how-to/${h.slug}`,
         title: h.shortTitle,
         description: h.tagline,
      }));
