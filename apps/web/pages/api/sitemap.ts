import { landingOrigin, publicEnv } from "@/lib/env";
import { LANDING_ROUTES } from "@/lib/site-config";
import { EDGE_CACHE_CONTROL, SITE_PATHS } from "@s3-viewer/types";
import type { NextApiRequest, NextApiResponse } from "next";

const ROUTES = landingOrigin
   ? [...LANDING_ROUTES, SITE_PATHS.login]
   : [SITE_PATHS.login];

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
   const origin = publicEnv.siteOrigin;
   if (!origin) {
      res.status(404).end();
      return;
   }
   const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}
</urlset>
`;
   res.setHeader("Content-Type", "application/xml");
   res.setHeader("Cache-Control", EDGE_CACHE_CONTROL);
   res.status(200).send(body);
};

export default handler;
