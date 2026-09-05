import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

const isProduction = process.env.NODE_ENV === "production";

// proxied behind apps/web: a path prefix keeps `/_next/*` on that app's domain
// (it proxies `/landing-assets/*` back here), so landing needs no hostname of
// its own. an absolute NEXT_PUBLIC_ASSET_PREFIX is for a deployment that
// serves its own assets
const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "/landing-assets";
const assetOrigin = assetPrefix.startsWith("/") ? undefined : assetPrefix;

// this header replaces the web app's on the proxied page, so it must name the
// asset origin when assets are cross-origin. next dev's webpack runtime needs
// eval, and without it the dev-only anti-flicker style never lifts
const asset = assetOrigin ? ` ${assetOrigin}` : "";
const contentSecurityPolicy = [
   "default-src 'self'",
   `script-src 'self'${asset}${isProduction ? "" : " 'unsafe-eval'"}`,
   `style-src 'self' 'unsafe-inline'${asset}`,
   `img-src 'self' data: https://cdn-may.com${asset}`,
   `font-src 'self' data:${asset}`,
   `connect-src 'self'${asset}`,
   "media-src 'self'",
   "frame-src 'none'",
   "object-src 'none'",
   "frame-ancestors 'none'",
   "base-uri 'self'",
   "form-action 'self'",
].join("; ");

const securityHeaders = [
   { key: "Content-Security-Policy", value: contentSecurityPolicy },
   { key: "X-Content-Type-Options", value: "nosniff" },
   { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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

const nextConfig: NextConfig = {
   output: "standalone",
   reactStrictMode: true,
   poweredByHeader: false,
   transpilePackages: ["@s3-viewer/ui"],
   assetPrefix,
   images: { path: `${assetPrefix}/_next/image` },
   headers: async () => [
      { source: "/(.*)", headers: securityHeaders },
      ...(assetOrigin
         ? [
              {
                 source: "/_next/static/:path*",
                 headers: [
                    {
                       key: "Access-Control-Allow-Origin",
                       value: new URL(siteUrl).origin,
                    },
                 ],
              },
           ]
         : []),
   ],
};

export default nextConfig;
