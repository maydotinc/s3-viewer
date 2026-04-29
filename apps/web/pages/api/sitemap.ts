import type { NextApiRequest, NextApiResponse } from "next";
import { SITE_URL } from "@/lib/site-config";

type ChangeFreq =
   | "always"
   | "hourly"
   | "daily"
   | "weekly"
   | "monthly"
   | "yearly"
   | "never";

type Page = {
   path: string;
   changefreq: ChangeFreq;
   priority: string;
};

const USE_CASE_SLUGS = [
   "multi-cloud",
   "share-with-non-technical-users",
   "teams",
   "s3-browser",
   "cloudflare-r2",
   "security-and-audit",
];

const HOW_TO_SLUGS = [
   "rename-s3-file",
   "share-s3-file-with-non-technical-user",
   "invite-teammate-to-s3-bucket",
   "view-s3-and-r2-side-by-side",
   "switch-between-s3-buckets",
   "upload-large-files-to-s3",
   "download-file-from-s3",
   "set-granular-s3-permissions",
   "search-across-s3-buckets",
   "delete-file-from-s3",
];

const pages: Page[] = [
   { path: "/", changefreq: "weekly", priority: "1.0" },
   { path: "/about", changefreq: "monthly", priority: "0.7" },
   { path: "/use-cases", changefreq: "weekly", priority: "0.8" },
   { path: "/how-to", changefreq: "weekly", priority: "0.8" },
   ...USE_CASE_SLUGS.map<Page>((slug) => ({
      path: `/use-cases/${slug}`,
      changefreq: "monthly",
      priority: "0.7",
   })),
   ...HOW_TO_SLUGS.map<Page>((slug) => ({
      path: `/how-to/${slug}`,
      changefreq: "monthly",
      priority: "0.75",
   })),
   { path: "/login", changefreq: "monthly", priority: "0.4" },
   { path: "/signup", changefreq: "monthly", priority: "0.4" },
   { path: "/brand-kit", changefreq: "monthly", priority: "0.4" },
   { path: "/legal", changefreq: "monthly", priority: "0.3" },
   { path: "/legal/terms-of-service", changefreq: "monthly", priority: "0.3" },
   { path: "/legal/privacy-policy", changefreq: "monthly", priority: "0.3" },
];

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
   const lastmod = new Date().toISOString().split("T")[0];
   const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
   .map(
      (p) => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
   )
   .join("\n")}
</urlset>`;

   res.setHeader("Content-Type", "application/xml");
   res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
   );
   res.status(200).send(sitemap);
}
