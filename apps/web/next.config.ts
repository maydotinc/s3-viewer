import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   reactStrictMode: true,
   async rewrites() {
      return [
         { source: "/robots.txt", destination: "/api/robots" },
         { source: "/sitemap.xml", destination: "/api/sitemap" },
      ];
   },
   transpilePackages: [
      "@s3-viewer/ui",
      "@s3-viewer/auth",
      "@s3-viewer/permissions",
      "@s3-viewer/types",
   ],
   images: {
      unoptimized: false,
      remotePatterns: [],
   },
};

export default nextConfig;
