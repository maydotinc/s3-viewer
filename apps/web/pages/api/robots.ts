import { publicEnv } from "@/lib/env";
import { SITE_PATHS } from "@s3-viewer/types";
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
   res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
   );
   res.status(200).send(body);
};

export default handler;
