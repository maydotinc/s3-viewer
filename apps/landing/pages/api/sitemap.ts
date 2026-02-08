import type { NextApiRequest, NextApiResponse } from "next";
import { SITE_URL } from "@/lib/site-config";

const pages = [
   { path: "/", changefreq: "weekly" as const, priority: "1.0" },
   {
      path: "/privacy-policy",
      changefreq: "monthly" as const,
      priority: "0.5",
   },
   {
      path: "/tos",
      changefreq: "monthly" as const,
      priority: "0.5",
   },
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
   res.status(200).send(sitemap);
}
