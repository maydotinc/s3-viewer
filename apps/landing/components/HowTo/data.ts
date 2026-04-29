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
         "S3 has no rename API — here's the copy + delete pattern, with metadata, tags, and the 5 GB cliff.",
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
         "Skip per-person IAM users. Invite by email, assign per-bucket roles, off-board without rotating keys.",
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
         "Multipart upload explained — part sizes, parallelism, retries, the 5 GB single-PUT cap, and the 10,000-parts ceiling.",
      keyword: "upload large files to S3",
      category: "Files",
   },
   {
      slug: "download-file-from-s3",
      title: "How to download a file from S3",
      shortTitle: "Download a file",
      tagline:
         "Three ways — browser, AWS CLI, presigned URL — and how to share with someone who has no AWS access.",
      keyword: "download file from S3",
      category: "Files",
   },
   {
      slug: "set-granular-s3-permissions",
      title: "How to set granular S3 permissions per prefix",
      shortTitle: "Granular permissions",
      tagline:
         "The IAM s3:prefix Condition that everyone forgets, plus when to use workspace roles instead of writing IAM.",
      keyword: "S3 permissions per prefix",
      category: "Permissions",
   },
   {
      slug: "search-across-s3-buckets",
      title: "How to search across S3 buckets",
      shortTitle: "Search across buckets",
      tagline:
         "Why the AWS console search misses files, how to actually find one, and when to use S3 Inventory + Athena.",
      keyword: "search S3 buckets",
      category: "Files",
   },
   {
      slug: "delete-file-from-s3",
      title: "How to delete a file from S3 safely",
      shortTitle: "Delete a file",
      tagline:
         "Versioning, delete markers, MFA Delete — and how to actually purge an object instead of soft-deleting it.",
      keyword: "delete file from S3",
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
