import { NONCE_HEADER, contentSecurityPolicy } from "@/lib/csp";
import { landingOrigin } from "@/lib/env";
import { LANDING_ROUTES, LEGACY_REDIRECTS } from "@/lib/site-config";
import { NextRequest, NextResponse } from "next/server";

const LANDING_PATHS = new Set(LANDING_ROUTES);
const LANDING_SECTIONS = LANDING_ROUTES.filter((route) => route !== "/");

// apps/landing builds its `/_next/*` URLs under this path (its `assetPrefix`),
// so its chunks, styles, fonts and optimised images are fetched from this
// app's origin and proxied back to it — no second public hostname, and no
// build-time origin baked into the landing image.
const LANDING_ASSETS = "/landing-assets/";

const isLandingPath = (pathname: string) =>
   LANDING_PATHS.has(pathname) ||
   pathname.startsWith("/landing/") ||
   LANDING_SECTIONS.some((route) => pathname.startsWith(`${route}/`));

const newNonce = (): string => btoa(crypto.randomUUID());

// `set`, never `append`: a client that sends its own `x-nonce` must not get a
// say in what `_document` stamps on the scripts it emits.
const withNonce = (request: NextRequest, nonce: string) => {
   const headers = new Headers(request.headers);
   headers.set(NONCE_HEADER, nonce);
   return { request: { headers } };
};

// the landing app renders marketing pages signed out; it has no session to
// read and no endpoint to act on one. Forwarding the viewer's cookies (or a
// bearer token) to it would hand credentials to a service that never needs
// them, and to whatever cache sits in front of it.
const withoutCredentials = (request: NextRequest) => {
   const headers = new Headers(request.headers);
   headers.delete("cookie");
   headers.delete("authorization");
   return { request: { headers } };
};

// a response rendered by the landing app cannot carry this request's nonce, so
// its policy keeps the host allowlist instead
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

   // llms.txt describes the marketing pages, so the copy lives with them
   if (landingOrigin && pathname === "/llms.txt") {
      return proxy(new URL("/api/llms", landingOrigin));
   }

   const redirect = LEGACY_REDIRECTS[pathname];
   if (redirect) {
      return own(NextResponse.redirect(new URL(redirect, request.url), 301));
   }

   if (landingOrigin && isLandingPath(pathname)) {
      return proxy(new URL(pathname + search, landingOrigin));
   }

   return own(NextResponse.next(withNonce(request, nonce)));
};

// The policy goes on every response rather than on each branch: a rewrite or a
// redirect that returned it on its own is exactly how one loses the header.
const middleware = (request: NextRequest): NextResponse => {
   const nonce = newNonce();
   const { response, landing } = route(request, nonce);
   response.headers.set(
      "Content-Security-Policy",
      contentSecurityPolicy(landing ? {} : { nonce })
   );
   return response;
};

// everything but the fingerprinted build output: narrowing this further is how
// api routes, 404s and error pages ship without a policy
export const config = {
   matcher: ["/((?!_next/static|_next/image).*)"],
};

export default middleware;
