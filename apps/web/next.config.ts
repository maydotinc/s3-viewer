import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   /* config options here */
   reactStrictMode: true,
   transpilePackages: [
      "@s3-viewer/ui",
      "@s3-viewer/auth",
      "@s3-viewer/permissions",
      "@s3-viewer/types",
   ],
   typescript: {
      ignoreBuildErrors: true,
   },
   eslint: {
      ignoreDuringBuilds: true,
   },
   images: {
      unoptimized: false,
      remotePatterns: [],
   },
};

export default nextConfig;
