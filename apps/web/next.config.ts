import {
   SITE_PATHS,
   STATIC_ASSET_CACHE_CONTROL,
   securityHeaders,
} from "@s3-viewer/types";
import type { NextConfig } from "next";
import { STATIC_PUBLIC_FILE_PATTERN } from "./lib/static-public-files";

const isProduction = process.env.NODE_ENV === "production";

// the reset link carries a one-time token in the query string.
const TOKEN_ROUTES = [SITE_PATHS.resetPassword];

const STATIC_PUBLIC_ROUTES = [
   "/icons/:path*",
   `/:file(${STATIC_PUBLIC_FILE_PATTERN})`,
];

const nextConfig: NextConfig = {
   output: "standalone",
   outputFileTracingIncludes: {
      "/*": ["../../packages/ui/src/fonts/LICENSE.txt"],
   },
   reactStrictMode: true,
   poweredByHeader: false,
   transpilePackages: [
      "@s3-viewer/ui",
      "@s3-viewer/auth",
      "@s3-viewer/permissions",
      "@s3-viewer/types",
   ],
   rewrites: async () => [
      { source: "/robots.txt", destination: "/api/robots" },
   ],
   redirects: async () => [
      {
         source: "/settings",
         destination: SITE_PATHS.settingsProfile,
         permanent: false,
      },
   ],
   headers: async () => [
      { source: "/(.*)", headers: securityHeaders(isProduction) },
      ...TOKEN_ROUTES.map((source) => ({
         source,
         headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
      ...STATIC_PUBLIC_ROUTES.map((source) => ({
         source,
         headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      })),
   ],
};

export default nextConfig;
