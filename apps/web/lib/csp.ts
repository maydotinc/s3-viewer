import { landingOrigin, publicEnv } from "@/lib/env";

const isDevelopment = process.env.NODE_ENV !== "production";

// the middleware mints a nonce per request and forwards it under this name;
// `_document` reads it back and stamps it on every script it emits.
const NONCE_HEADER = "x-nonce";

// Object previews load presigned URLs straight from whichever S3 endpoint a
// server was connected with, so the policy can only name a scheme. Keying that
// off the install's own origin rather than NODE_ENV is what lets the published
// (NODE_ENV=production) image preview objects on a LAN MinIO: an install served
// over http:// has nothing to lose by allowing http:// endpoints, while an
// https:// one keeps mixed content out.
const remoteSchemes = (): string =>
   publicEnv.siteOrigin.startsWith("http://") ? "https: http:" : "https:";

// The three shapes cannot be merged: a nonce makes browsers ignore
// 'unsafe-inline', and 'strict-dynamic' makes them ignore host allowlists. So
// pages this app renders get the nonce (their scripts all come from
// `_document`), landing pages proxied from another Next app keep the allowlist
// because nothing here can stamp their markup, and the dev server keeps both
// the eval and the inline scripts its refresh runtime injects.
const scriptSrc = (nonce: string | undefined, landing: string): string => {
   if (isDevelopment) return `'self' 'unsafe-inline' 'unsafe-eval'${landing}`;
   return nonce
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'unsafe-inline'${landing}`;
};

// `connect-src` has to name the api origin, and that origin is only known when
// the server boots, so the policy is built per request here rather than baked
// into the routes manifest by next.config.ts.
const contentSecurityPolicy = ({ nonce }: { nonce?: string } = {}): string => {
   const landing = landingOrigin ? ` ${landingOrigin}` : "";
   const remote = remoteSchemes();
   const api = publicEnv.apiOrigin ? ` ${publicEnv.apiOrigin}` : "";
   return [
      "default-src 'self'",
      `script-src ${scriptSrc(nonce, landing)}`,
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

export { NONCE_HEADER, contentSecurityPolicy };
