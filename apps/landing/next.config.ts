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

const nextConfig: NextConfig = {
   reactStrictMode: true,
   transpilePackages: ["@s3-viewer/ui"],
   ...(assetPrefix && {
      assetPrefix,
      images: { path: `${assetPrefix}/_next/image` },
      headers: async () => [
         {
            source: "/_next/static/:path*",
            headers: [
               {
                  key: "Access-Control-Allow-Origin",
                  value: new URL(siteUrl).origin,
               },
            ],
         },
      ],
   }),
};

export default nextConfig;
