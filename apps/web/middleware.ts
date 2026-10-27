import { NONCE_HEADER, contentSecurityPolicy } from "@/lib/csp";
import { landingOrigin } from "@/lib/env";
import { LANDING_ROUTES, LEGAL_ALIAS_REDIRECTS } from "@/lib/site-config";
import { NextRequest, NextResponse } from "next/server";

const LANDING_PATHS = new Set(LANDING_ROUTES);
const LANDING_SECTIONS = LANDING_ROUTES.filter((route) => route !== "/");

const LANDING_ASSETS = "/landing-assets/";

const isLandingPath = (pathname: string) =>
   LANDING_PATHS.has(pathname) ||
   pathname.startsWith("/landing/") ||
   LANDING_SECTIONS.some((route) => pathname.startsWith(`${route}/`));

const newNonce = (): string => btoa(crypto.randomUUID());

// `set`, never `append`: a client-sent `x-nonce` must not reach `_document`.
const withNonce = (request: NextRequest, nonce: string) => {
   const headers = new Headers(request.headers);
   headers.set(NONCE_HEADER, nonce);
   return { request: { headers } };
};

// landing pages render signed out; never forward credentials to them or their cache.
const withoutCredentials = (request: NextRequest) => {
   const headers = new Headers(request.headers);
   headers.delete("cookie");
   headers.delete("authorization");
   return { request: { headers } };
};

type Routed = { response: NextResponse; landing: boolean };

const route = (request: NextRequest, nonce: string): Routed => {
   const { pathname, search } = request.nextUrl;

   const proxy = (url: URL): Routed => ({
      response: NextResponse.rewrite(url, withoutCredentials(request)),
      landing: true,
   });
   const own = (response: NextResponse): Routed => ({
      response,
      landing: false,
   });

   if (landingOrigin && pathname.startsWith(LANDING_ASSETS)) {
      return proxy(new URL(pathname + search, landingOrigin));
   }

   if (pathname === "/sitemap.xml") {
      return own(
         NextResponse.rewrite(
            new URL("/api/sitemap", request.url),
            withNonce(request, nonce)
         )
      );
   }

   if (landingOrigin && pathname === "/llms.txt") {
      return proxy(new URL("/api/llms", landingOrigin));
   }

   // the legal pages live on the landing site, so without it these would redirect to a 404
   const redirect = landingOrigin && LEGAL_ALIAS_REDIRECTS[pathname];
   if (redirect) {
      return own(NextResponse.redirect(new URL(redirect, request.url), 301));
   }

   if (landingOrigin && isLandingPath(pathname)) {
      return proxy(new URL(pathname + search, landingOrigin));
   }

   return own(NextResponse.next(withNonce(request, nonce)));
};

const middleware = (request: NextRequest): NextResponse => {
   const nonce = newNonce();
   const { response, landing } = route(request, nonce);
   response.headers.set(
      "Content-Security-Policy",
      contentSecurityPolicy(landing ? {} : { nonce })
   );
   return response;
};

// static public files need neither a nonce nor a document CSP. Next only reads a literal matcher,
// so this spells out lib/static-public-files.ts; middleware.test.ts keeps the two aligned.
export const config = {
   matcher: [
      "/((?!_next/static|_next/image|icons/|(?:favicon\\.ico|favicon\\.svg|favicon-96x96\\.png|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|icon-maskable-192\\.png|icon-maskable-512\\.png|site\\.webmanifest|social-card\\.png)$).*)",
   ],
};

export default middleware;
