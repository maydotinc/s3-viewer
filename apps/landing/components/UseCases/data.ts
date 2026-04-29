export type UseCaseEntry = {
   slug: string;
   title: string;
   tagline: string;
   keyword: string;
};

export const USE_CASES: UseCaseEntry[] = [
   {
      slug: "multi-cloud",
      title: "Multi-cloud",
      tagline:
         "AWS S3, Cloudflare R2, MinIO, B2, and Wasabi in one window — built for developers managing more than one cloud.",
      keyword: "multi-cloud S3 dashboard",
   },
   {
      slug: "share-with-non-technical-users",
      title: "Sharing without AWS",
      tagline:
         "Let clients, designers, and execs view S3 files in a browser — no IAM, no AWS console, no CLI.",
      keyword: "share S3 files with non-technical user",
   },
   {
      slug: "teams",
      title: "Team workspaces",
      tagline:
         "Invite teammates by email, assign per-bucket roles, revoke without rotating IAM keys.",
      keyword: "S3 bucket team access",
   },
   {
      slug: "s3-browser",
      title: "Better S3 browser",
      tagline:
         "Bucket-wide key search, inline previews, multipart upload, and Cmd-K bucket switching.",
      keyword: "S3 browser",
   },
   {
      slug: "cloudflare-r2",
      title: "Cloudflare R2",
      tagline:
         "A real dashboard for R2 — search, rename, share, and side-by-side with AWS S3.",
      keyword: "Cloudflare R2 dashboard",
   },
   {
      slug: "security-and-audit",
      title: "Security",
      tagline:
         "RSA-4096 encrypted credentials, zero object retention, MIT open source, fully self-hostable.",
      keyword: "secure S3 access management",
   },
];

export const getRelated = (currentSlug: string) =>
   USE_CASES.filter((u) => u.slug !== currentSlug)
      .slice(0, 3)
      .map((u) => ({
         href: `/use-cases/${u.slug}`,
         title: u.title,
         description: u.tagline,
      }));

export const getUseCaseRefs = (slugs: string[]) =>
   slugs
      .map((s) => USE_CASES.find((u) => u.slug === s))
      .filter((u): u is UseCaseEntry => Boolean(u))
      .map((u) => ({
         href: `/use-cases/${u.slug}`,
         title: u.title,
         description: u.tagline,
      }));
