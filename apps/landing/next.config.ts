import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   reactStrictMode: true,
   transpilePackages: ["@s3-viewer/ui"],
   assetPrefix:
      process.env.NODE_ENV === "production"
         ? "https://s3-viewer-lp.vercel.app"
         : "https://landing.localhost",
   async headers() {
      const isProd = process.env.NODE_ENV === "production";
      const allowedOrigin = isProd
         ? "https://s3-viewer.com"
         : "https://web.localhost";
      return [
         // Fonts are fetched with CORS when served cross-origin (e.g. page on
         // web.localhost / s3-viewer.com but assets from landing.localhost / s3-viewer-lp.vercel.app).
         {
            source: "/_next/static/:path*",
            headers: [
               { key: "Access-Control-Allow-Origin", value: allowedOrigin },
               { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
            ],
         },
      ];
   },
   images: {
      loader: "custom",
      loaderFile: "./image-loader.js",
   },
};

export default nextConfig;
