import type { NextApiRequest, NextApiResponse } from "next";
import { SITE_URL } from "@/lib/site-config";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
   const robots = `# S3 Viewer App - authenticated dashboard
User-agent: *
Disallow: /dashboard
Disallow: /buckets
Disallow: /invites
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

   res.setHeader("Content-Type", "text/plain");
   res.status(200).send(robots);
}
