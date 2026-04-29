import { NextRequest, NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

const landingOrigin = {
   hostname: isProd ? "s3-viewer-lp.vercel.app" : "landing.localhost",
   protocol: "https" as const,
   port: "",
};

const rewriteToLanding = (url: URL) => {
   url.hostname = landingOrigin.hostname;
   url.protocol = landingOrigin.protocol;
   url.port = landingOrigin.port;
   return NextResponse.rewrite(url.toString());
};

const LANDING_OWNED = [
   "/legal",
   "/about",
   "/use-cases",
   "/how-to",
   "/brand-kit",
];

const TERMS_ALIASES = new Set([
   "/tos",
   "/terms",
   "/terms-of-service",
   "/terms-and-conditions",
   "/terms-conditions",
]);
const PRIVACY_ALIASES = new Set([
   "/privacy",
   "/privacy-policy",
   "/privacy-notice",
]);

// Old slugs from the previous IA — 301 to the closest current page so existing
// inbound links keep their SEO equity.
const USE_CASE_REDIRECTS: Record<string, string> = {
   "/use-cases/backups": "/use-cases/security-and-audit",
   "/use-cases/media": "/use-cases/s3-browser",
   "/use-cases/data-engineering": "/use-cases/s3-browser",
   "/use-cases/ai-ml": "/use-cases/s3-browser",
};

function middleware(request: NextRequest) {
   const url = request.nextUrl.clone();
   const { pathname } = request.nextUrl;
   const lower = pathname.toLowerCase();

   if (lower === "/sitemap.xml") {
      url.pathname = "/api/sitemap";
      return NextResponse.rewrite(url.toString());
   }

   if (pathname.startsWith("/landing/")) {
      return rewriteToLanding(url);
   }

   if (TERMS_ALIASES.has(lower)) {
      const dest = url.clone();
      dest.pathname = "/legal/terms-of-service";
      return NextResponse.redirect(dest.toString(), 301);
   }
   if (PRIVACY_ALIASES.has(lower)) {
      const dest = url.clone();
      dest.pathname = "/legal/privacy-policy";
      return NextResponse.redirect(dest.toString(), 301);
   }

   const useCaseRedirect = USE_CASE_REDIRECTS[lower];
   if (useCaseRedirect) {
      const dest = url.clone();
      dest.pathname = useCaseRedirect;
      return NextResponse.redirect(dest.toString(), 301);
   }

   const isLowerCanonical =
      pathname === lower ||
      pathname === "/" ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/api/");
   if (!isLowerCanonical) {
      const ownsLower =
         lower === "/" ||
         LANDING_OWNED.some(
            (p) => lower === p || lower.startsWith(`${p}/`)
         );
      if (ownsLower) {
         const dest = url.clone();
         dest.pathname = lower;
         return NextResponse.redirect(dest.toString(), 301);
      }
   }

   if (pathname === "/") {
      return rewriteToLanding(url);
   }

   const matchesLanding = LANDING_OWNED.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
   );
   if (matchesLanding) {
      return rewriteToLanding(url);
   }

   return NextResponse.next();
}

export default middleware;
