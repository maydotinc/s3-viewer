import { landingOrigin, publicEnv } from "./env";

// fails closed: an unset or custom NODE_ENV must not relax script-src
const isDevelopment = process.env.NODE_ENV === "development";

const NONCE_HEADER = "x-nonce";

const remoteSchemes = (): string =>
   publicEnv.siteOrigin.startsWith("http://") ? "https: http:" : "https:";

// unmergeable: a nonce voids 'unsafe-inline', 'strict-dynamic' voids host allowlists; landing and dev can't be nonced.
const scriptSrc = (nonce: string | undefined, landing: string): string => {
   if (isDevelopment) return `'self' 'unsafe-inline' 'unsafe-eval'${landing}`;
   return nonce
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'unsafe-inline'${landing}`;
};

const contentSecurityPolicy = ({ nonce }: { nonce?: string } = {}): string => {
   const landing = landingOrigin ? ` ${landingOrigin}` : "";
   const remote = remoteSchemes();
   const api = publicEnv.apiOrigin ? ` ${publicEnv.apiOrigin}` : "";
   return [
      "default-src 'self'",
      `script-src ${scriptSrc(nonce, landing)}`,
      // Sonner's unnonced styles and Radix's inline positioning need 'unsafe-inline'.
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
