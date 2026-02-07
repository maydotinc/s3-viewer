import type { NextApiRequest, NextApiResponse } from "next";
import { SITE_URL } from "@/lib/site-config";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
   const robots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

   res.setHeader("Content-Type", "text/plain");
   res.status(200).send(robots);
}
