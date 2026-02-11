import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   reactStrictMode: true,
   transpilePackages: ["@s3-viewer/ui"],
   async rewrites() {
      return [
         { source: "/robots.txt", destination: "/api/robots" },
         { source: "/sitemap.xml", destination: "/api/sitemap" },
      ];
   },
   assetPrefix:
      process.env.NODE_ENV === "production"
         ? "https://s3-viewer-lp.vercel.app"
         : "http://localhost:3001",
   async headers() {
      const isProd = process.env.NODE_ENV === "production";
      const allowedOrigin = isProd
         ? "https://s3-viewer.com"
         : "http://localhost:3000";
      return [
         // Fonts are fetched with CORS when served cross-origin (e.g. page on
         // localhost:3000 / s3-viewer.com but assets from localhost:3001 / s3-viewer-lp.vercel.app).
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
