import { landingOrigin, publicEnv } from "@/lib/env";

const isDevelopment = process.env.NODE_ENV !== "production";

// Object previews load presigned URLs straight from whichever S3 endpoint a
// server was connected with, so the policy can only name a scheme. Keying that
// off the install's own origin rather than NODE_ENV is what lets the published
// (NODE_ENV=production) image preview objects on a LAN MinIO: an install served
// over http:// has nothing to lose by allowing http:// endpoints, while an
// https:// one keeps mixed content out.
const remoteSchemes = (): string =>
   publicEnv.siteOrigin.startsWith("http://") ? "https: http:" : "https:";

// `connect-src` has to name the api origin, and that origin is only known when
// the server boots, so the policy is built per request here rather than baked
// into the routes manifest by next.config.ts.
const contentSecurityPolicy = (): string => {
   const landing = landingOrigin ? ` ${landingOrigin}` : "";
   const remote = remoteSchemes();
   const api = publicEnv.apiOrigin ? ` ${publicEnv.apiOrigin}` : "";
   return [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${landing}${isDevelopment ? " 'unsafe-eval'" : ""}`,
      `style-src 'self' 'unsafe-inline'${landing}`,
      `img-src 'self' data: blob: ${remote}`,
      `font-src 'self' data:${landing}`,
      `media-src blob: ${remote}`,
      `frame-src ${remote}`,
      `connect-src 'self'${api} ${remote}${isDevelopment ? " ws: wss:" : ""}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
   ].join("; ");
};

export { contentSecurityPolicy };
