import { publicEnv } from "@/lib/env";
import { LANDING_ROUTES } from "@/lib/site-config";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextApiRequest, NextApiResponse } from "next";

const ROUTES = [...LANDING_ROUTES, SITE_PATHS.login];

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
   const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map((path) => `  <url><loc>${publicEnv.siteOrigin}${path}</loc></url>`).join("\n")}
</urlset>
`;
   res.setHeader("Content-Type", "application/xml");
   res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
   );
   res.status(200).send(body);
};

export default handler;
