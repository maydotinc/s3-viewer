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
         "View AWS S3, Cloudflare R2, B2, MinIO, and Wasabi from one window.",
      keyword: "multi-cloud S3 dashboard",
   },
   {
      slug: "share-with-non-technical-users",
      title: "Sharing without AWS",
      tagline:
         "Let non-technical teammates view S3 files without IAM, the console, or a CLI.",
      keyword: "share S3 files with non-technical user",
   },
   {
      slug: "teams",
      title: "Team workspaces",
      tagline:
         "Invite teammates, scope them per bucket or prefix, revoke in one click.",
      keyword: "S3 bucket team access",
   },
   {
      slug: "s3-browser",
      title: "Better S3 browser",
      tagline:
         "Real key search, inline previews, multi-select, and clean downloads.",
      keyword: "S3 browser",
   },
   {
      slug: "cloudflare-r2",
      title: "Cloudflare R2",
      tagline:
         "A real dashboard for R2: search, rename, share, and side-by-side with S3.",
      keyword: "Cloudflare R2 dashboard",
   },
   {
      slug: "security-and-audit",
      title: "Security & audit",
      tagline:
         "Encrypted credentials, audit log of every action, and zero object storage on our side.",
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
