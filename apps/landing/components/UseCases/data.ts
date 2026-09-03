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
         "AWS S3, Cloudflare R2, MinIO, B2, and Wasabi — same sidebar, same file browser, one server at a time.",
      keyword: "multi-cloud S3 dashboard",
   },
   {
      slug: "share-with-non-technical-users",
      title: "Sharing without AWS",
      tagline:
         "Email-invite clients and execs to a clean browser view of one bucket — revocable in one click, no IAM.",
      keyword: "share S3 files with non-technical user",
   },
   {
      slug: "teams",
      title: "Team workspaces",
      tagline:
         "Per-bucket roles, no per-person IAM, and one-click off-boarding without rotating any keys.",
      keyword: "S3 bucket team access",
   },
   {
      slug: "s3-browser",
      title: "Better S3 browser",
      tagline:
         "Rename, prefix search, multi-select delete and inline previews — focused on the daily browsing layer.",
      keyword: "S3 browser",
   },
   {
      slug: "cloudflare-r2",
      title: "Cloudflare R2",
      tagline:
         "Rename, filter, upload, and team sharing on top of Cloudflare R2's S3-compatible API.",
      keyword: "Cloudflare R2 dashboard",
   },
   {
      slug: "security-and-audit",
      title: "Security",
      tagline:
         "Credentials encrypted in your browser, zero object retention, MIT open source, fully self-hostable.",
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
