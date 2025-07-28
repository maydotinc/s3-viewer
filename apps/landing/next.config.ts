import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   /* config options here */
   reactStrictMode: true,
   transpilePackages: ["@s3-viewer/ui"],
};

export default nextConfig;
