import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

const isProduction = process.env.NODE_ENV === "production";

const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX || "/landing-assets";
const assetOrigin = assetPrefix.startsWith("/") ? undefined : assetPrefix;

const asset = assetOrigin ? ` ${assetOrigin}` : "";
// proxied pages replace the web app's CSP; Next.js's dev runtime requires eval.
const contentSecurityPolicy = [
   "default-src 'self'",
   `script-src 'self'${asset}${isProduction ? "" : " 'unsafe-eval'"}`,
   `style-src 'self' 'unsafe-inline'${asset}`,
   `img-src 'self' data:${asset}`,
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
   outputFileTracingIncludes: {
      "/*": ["../../packages/ui/src/fonts/LICENSE.txt"],
   },
   reactStrictMode: true,
   poweredByHeader: false,
   transpilePackages: ["@s3-viewer/ui"],
   assetPrefix,
   images: {
      path: `${assetPrefix}/_next/image`,
      remotePatterns: [
         { protocol: "https", hostname: "cdn-may.com", pathname: "/assets/**" },
      ],
   },
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
