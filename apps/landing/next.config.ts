import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

const assetPrefix = process.env.NEXT_PUBLIC_ASSET_PREFIX;
if (!assetPrefix && process.env.NODE_ENV === "production") {
   throw new Error("NEXT_PUBLIC_ASSET_PREFIX is not set");
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
