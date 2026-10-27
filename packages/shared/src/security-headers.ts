type HttpHeader = { key: string; value: string };

// public/ files are not content-hashed, so they revalidate daily rather than being marked immutable
export const STATIC_ASSET_CACHE_CONTROL =
   "public, max-age=86400, stale-while-revalidate=604800";

// generated text files (robots, sitemap, llms.txt) cache for an hour at shared caches but never in the browser
export const EDGE_CACHE_CONTROL =
   "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

// HSTS leaves out includeSubDomains: a self-hosted instance must not force HTTPS onto sibling hosts of its domain
export const securityHeaders = (isProduction: boolean): HttpHeader[] => [
   { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
   { key: "X-Content-Type-Options", value: "nosniff" },
   {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
   },
   ...(isProduction
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]
      : []),
];
