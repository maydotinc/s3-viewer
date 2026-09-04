import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

const isProduction = process.env.NODE_ENV === "production";
const assetPrefix = isProduction
   ? process.env.NEXT_PUBLIC_ASSET_PREFIX
   : undefined;
if (isProduction && !assetPrefix) {
   throw new Error(
      "NEXT_PUBLIC_ASSET_PREFIX is not set. This landing app is designed to " +
         "be reverse-proxied behind apps/web in production, so its pages are " +
         "served from that app's domain while its own static/_next assets " +
         "still need to resolve back to landing's real origin. Set " +
         "NEXT_PUBLIC_ASSET_PREFIX to this deployment's own public origin " +
         "(e.g. https://landing.internal) — even when running landing " +
         "standalone with no proxy in front, set it to landing's own URL. " +
         "See apps/landing/.env.example."
   );
}

// no inline <script> anywhere, so script-src stays 'self'; style-src needs
// 'unsafe-inline' for a few components' inline style={{}}. cdn-may.com is the
// only cross-origin resource any page loads.
const contentSecurityPolicy = [
   "default-src 'self'",
   "script-src 'self'",
   "style-src 'self' 'unsafe-inline'",
   "img-src 'self' data: https://cdn-may.com",
   "font-src 'self' data:",
   "connect-src 'self'",
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
   reactStrictMode: true,
   poweredByHeader: false,
   transpilePackages: ["@s3-viewer/ui"],
   ...(assetPrefix && {
      assetPrefix,
      images: { path: `${assetPrefix}/_next/image` },
   }),
   headers: async () => [
      { source: "/(.*)", headers: securityHeaders },
      ...(assetPrefix
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
