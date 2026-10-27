import { publicEnv } from "@/lib/env";
import { EDGE_CACHE_CONTROL, SITE_PATHS } from "@s3-viewer/shared";
import type { NextApiRequest, NextApiResponse } from "next";

const DISALLOWED = [
   SITE_PATHS.dashboard,
   SITE_PATHS.buckets,
   "/servers/",
   "/settings",
   SITE_PATHS.resetPassword,
   "/api/",
];

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
   const origin = publicEnv.siteOrigin;
   const body = [
      "User-agent: *",
      "Allow: /",
      ...DISALLOWED.map((path) => `Disallow: ${path}`),
      ...(origin ? ["", `Sitemap: ${origin}/sitemap.xml`] : []),
      "",
   ].join("\n");
   res.setHeader("Content-Type", "text/plain");
   res.setHeader("Cache-Control", EDGE_CACHE_CONTROL);
   res.status(200).send(body);
};

export default handler;
