import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   reactStrictMode: true,
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
