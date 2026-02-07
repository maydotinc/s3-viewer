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
         ? "https://s3-viewer.onrender.com"
         : "http://localhost:3001",
   images: {
      loader: "custom",
      loaderFile: "./image-loader.js",
   },
};

export default nextConfig;
