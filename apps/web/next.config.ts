import { SITE_PATHS } from "@s3-viewer/types";
import type { NextConfig } from "next";
import { STATIC_PUBLIC_FILE_PATTERN } from "./lib/static-public-files";

const isProduction = process.env.NODE_ENV === "production";

// the reset link carries a one-time token in the query string.
const TOKEN_ROUTES = [SITE_PATHS.resetPassword];

const securityHeaders = [
   { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
   { key: "X-Content-Type-Options", value: "nosniff" },
   {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
   },
   ...(isProduction
      ? [
           {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains",
           },
        ]
      : []),
];

// public/ files are not content-hashed, so revalidate daily rather than marking them immutable.
const STATIC_PUBLIC_ROUTES = [
   "/icons/:path*",
   `/:file(${STATIC_PUBLIC_FILE_PATTERN})`,
];

const staticAssetHeaders = [
   {
      key: "Cache-Control",
      value: "public, max-age=86400, stale-while-revalidate=604800",
   },
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
      { source: "/(.*)", headers: securityHeaders },
      ...TOKEN_ROUTES.map((source) => ({
         source,
         headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
      ...STATIC_PUBLIC_ROUTES.map((source) => ({
         source,
         headers: staticAssetHeaders,
      })),
   ],
};

export default nextConfig;
