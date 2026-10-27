import { coveringEverySlug, pickBySlug } from "@/lib/every-slug";
import { toLinkRef, type LinkRef } from "@/lib/link-ref";
import type { HowToSlug } from "@s3-viewer/shared";

export const HOW_TO_CATEGORIES = [
   "Files",
   "Sharing",
   "Multi-cloud",
   "Permissions",
] as const;

type HowToCategory = (typeof HOW_TO_CATEGORIES)[number];

type HowToEntry = {
   slug: HowToSlug;
   title: string;
   shortTitle: string;
   tagline: string;
   keyword: string;
   category: HowToCategory;
};

export const HOW_TOS = coveringEverySlug<HowToEntry>()([
   {
      slug: "rename-s3-file",
      title: "How to rename a file in S3",
      shortTitle: "Rename an S3 file",
      tagline:
         "General purpose S3 buckets have no rename API — keys are immutable. Here's the standard copy + delete pattern, with metadata and tags preserved.",
      keyword: "rename file in S3",
      category: "Files",
   },
   {
      slug: "share-s3-file-with-non-technical-user",
      title: "How to share an S3 file with a non-technical user",
      shortTitle: "Share an S3 file",
      tagline:
         "Copy link for a 15-minute presigned URL, or an email invite for ongoing access — when each is the right call.",
      keyword: "share S3 file with non-technical user",
      category: "Sharing",
   },
   {
      slug: "invite-teammate-to-s3-bucket",
      title: "How to invite a teammate to your S3 bucket",
      shortTitle: "Invite a teammate",
      tagline:
         "Skip per-person IAM users for human collaboration. Email invite, per-bucket role, optional folder limit, one-click revoke.",
      keyword: "invite teammate to S3 bucket",
      category: "Sharing",
   },
   {
      slug: "share-one-folder-in-s3-bucket",
      title: "How to share one folder in an S3 bucket (not the whole bucket)",
      shortTitle: "Share one folder",
      tagline:
         "Neither the S3 console nor the R2 dashboard can share a folder with a person. IAM prefix policies cover programs; for people, invite them by email and limit the bucket to specific folders.",
      keyword: "share one folder in S3 bucket",
      category: "Sharing",
   },
   {
      slug: "view-s3-and-r2-side-by-side",
      title: "How to view AWS S3 and Cloudflare R2 in one dashboard",
      shortTitle: "View S3 + R2 together",
      tagline:
         "One credential per provider, one sidebar, and one click to switch between them.",
      keyword: "view S3 and R2 together",
      category: "Multi-cloud",
   },
   {
      slug: "copy-files-between-s3-and-r2",
      title: "How to copy files between AWS S3 and Cloudflare R2",
      shortTitle: "Copy S3 ↔ R2",
      tagline:
         "S3 Viewer's Copy to another bucket… now streams a file or folder across servers in-app; rclone still wins for bulk migrations.",
      keyword: "copy files from S3 to Cloudflare R2",
      category: "Multi-cloud",
   },
   {
      slug: "switch-between-s3-buckets",
      title: "How to switch between S3 buckets quickly",
      shortTitle: "Switch buckets fast",
      tagline:
         "Switch servers and buckets from the sidebar, plus AWS CLI named profiles for scripts.",
      keyword: "switch between S3 buckets",
      category: "Multi-cloud",
   },
   {
      slug: "upload-large-files-to-s3",
      title: "How to upload large files to S3",
      shortTitle: "Upload large files",
      tagline:
         "How large uploads work in S3 Viewer and from the CLI — streaming, retries, and the 5 GB single-PUT cap.",
      keyword: "upload large files to S3",
      category: "Files",
   },
   {
      slug: "secure-s3-upload-presigned-urls",
      title: "How to upload to S3 securely without exposing keys",
      shortTitle: "Secure S3 upload",
      tagline:
         "Never ship AWS keys to the browser. How S3 Viewer uploads through its server with nothing to configure on the bucket, and how presigned URLs fit in.",
      keyword: "S3 upload without exposing keys",
      category: "Files",
   },
   {
      slug: "download-file-from-s3",
      title: "How to download a file from S3",
      shortTitle: "Download a file",
      tagline:
         "Browser, AWS CLI, or presigned URL — three ways, with the object's own filename and zero key exposure.",
      keyword: "download file from S3",
      category: "Files",
   },
   {
      slug: "set-granular-s3-permissions",
      title: "How to set granular S3 permissions per prefix",
      shortTitle: "Granular permissions",
      tagline:
         "The IAM s3:prefix Condition that everyone misses, plus folder-limited roles for when IAM is more than you need.",
      keyword: "S3 permissions per prefix",
      category: "Permissions",
   },
   {
      slug: "search-across-s3-buckets",
      title: "How to search across S3 buckets",
      shortTitle: "Search inside a bucket",
      tagline:
         "S3 has no search API. Filter by prefix in the current folder, or reach for S3 Inventory + Athena.",
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
   {
      slug: "create-folder-in-s3",
      title: "How to create a folder in S3",
      shortTitle: "Create a folder",
      tagline:
         "S3 has no folders — only key prefixes. How the console, the CLI and S3 Viewer create one, and why an empty folder can vanish.",
      keyword: "create folder in S3",
      category: "Files",
   },
   {
      slug: "fix-s3-access-denied",
      title: "How to fix “Access Denied” (403) errors in S3",
      shortTitle: "Fix Access Denied",
      tagline:
         "A nine-point checklist: IAM actions and ARNs, bucket policy denies, Block Public Access, KMS keys, object ownership, and the 403-that-is-really-a-404.",
      keyword: "S3 access denied",
      category: "Permissions",
   },
   {
      slug: "iam-user-read-only-one-s3-bucket",
      title: "How to create an IAM user with read-only access to one S3 bucket",
      shortTitle: "Read-only IAM user",
      tagline:
         "The exact least-privilege policy JSON, the console and CLI steps, and how to connect the keys without s3:ListAllMyBuckets.",
      keyword: "S3 read-only IAM policy",
      category: "Permissions",
   },
   {
      slug: "edit-s3-object-metadata",
      title: "How to change an S3 object's content type or metadata",
      shortTitle: "Edit object metadata",
      tagline:
         "There's no UpdateObject call — changing a header means copying the object onto itself with MetadataDirective REPLACE.",
      keyword: "change S3 object content type",
      category: "Files",
   },
   {
      slug: "edit-file-in-s3",
      title: "How to edit a file in S3 without downloading it first",
      shortTitle: "Edit a file in place",
      tagline:
         "S3 has no edit API either — here's the read, change, conditional-write pattern for small text files, in the console, the CLI, and S3 Viewer.",
      keyword: "edit file in S3",
      category: "Files",
   },
   {
      slug: "download-s3-folder-as-zip",
      title: "How to download an S3 folder as a zip file",
      shortTitle: "Download a folder as zip",
      tagline:
         "S3 has no folder download endpoint. The CLI syncs a directory tree; S3 Viewer streams a zip built object by object, with size and count limits.",
      keyword: "download S3 folder as zip",
      category: "Files",
   },
   {
      slug: "bulk-rename-s3-files",
      title: "How to bulk-rename S3 files by pattern",
      shortTitle: "Bulk-rename files",
      tagline:
         "Find/replace, prefixes, suffixes and extensions across a whole selection — previewed before anything is copied or deleted.",
      keyword: "bulk rename S3 files",
      category: "Files",
   },
   {
      slug: "abort-incomplete-multipart-uploads-s3",
      title: "How to find and abort incomplete multipart uploads in S3",
      shortTitle: "Clean up multipart uploads",
      tagline:
         "A failed or abandoned upload leaves parts behind that ListObjects can't see and storage still bills for — here's how to find and abort them.",
      keyword: "abort incomplete multipart upload S3",
      category: "Files",
   },
]);

export const getRelatedHowTos = (slugs: HowToSlug[]): LinkRef[] =>
   slugs.map((slug) => {
      const entry = pickBySlug(HOW_TOS, slug);
      return toLinkRef("/how-to", entry, entry.shortTitle);
   });
