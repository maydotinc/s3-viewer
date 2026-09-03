import type { NextConfig } from "next";
import { origin } from "./lib/origin";

const isProduction = process.env.NODE_ENV === "production";

const requiredOrigin = (name: string): string => {
   const value = process.env[name];
   const parsed = origin(value);
   if (!parsed) {
      throw new Error(
         `${name} must be an http(s) URL such as https://example.com (got ${JSON.stringify(value ?? "")})`
      );
   }
   return parsed;
};

requiredOrigin("NEXT_PUBLIC_SITE_URL");
const apiOrigin = requiredOrigin("NEXT_PUBLIC_API_URL");

const landingOrigin = process.env.LANDING_ORIGIN
   ? ` ${requiredOrigin("LANDING_ORIGIN")}`
   : "";

const remote = isProduction ? "https:" : "https: http:";
const contentSecurityPolicy = [
   "default-src 'self'",
   `script-src 'self' 'unsafe-inline'${landingOrigin}${isProduction ? "" : " 'unsafe-eval'"}`,
   `style-src 'self' 'unsafe-inline'${landingOrigin}`,
   `img-src 'self' data: blob: ${remote}`,
   `font-src 'self' data:${landingOrigin}`,
   `media-src blob: ${remote}`,
   `frame-src ${remote}`,
   `connect-src 'self' ${apiOrigin}${isProduction ? "" : " ws: wss:"}`,
   "object-src 'none'",
   "frame-ancestors 'none'",
   "base-uri 'self'",
   "form-action 'self'",
].join("; ");

const securityHeaders = [
   { key: "Content-Security-Policy", value: contentSecurityPolicy },
   { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
   { key: "X-Content-Type-Options", value: "nosniff" },
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
   reactStrictMode: true,
   poweredByHeader: false,
   transpilePackages: [
      "@s3-viewer/ui",
      "@s3-viewer/auth",
      "@s3-viewer/permissions",
      "@s3-viewer/types",
   ],
   images: {
      remotePatterns: [
         { protocol: "https", hostname: "avatars.githubusercontent.com" },
      ],
   },
   headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};

export default nextConfig;
