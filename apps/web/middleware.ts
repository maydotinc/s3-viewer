import { contentSecurityPolicy } from "@/lib/csp";
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

const withPolicy = (response: NextResponse): NextResponse => {
   response.headers.set("Content-Security-Policy", contentSecurityPolicy());
   return response;
};

const route = (request: NextRequest): NextResponse => {
   const { pathname, search } = request.nextUrl;

   if (landingOrigin && pathname.startsWith(LANDING_ASSETS)) {
      return NextResponse.rewrite(new URL(pathname + search, landingOrigin));
   }

   if (pathname === "/sitemap.xml") {
      return NextResponse.rewrite(new URL("/api/sitemap", request.url));
   }

   // llms.txt describes the marketing pages, so the copy lives with them
   if (landingOrigin && pathname === "/llms.txt") {
      return NextResponse.rewrite(new URL("/api/llms", landingOrigin));
   }

   const redirect = LEGACY_REDIRECTS[pathname];
   if (redirect) {
      return NextResponse.redirect(new URL(redirect, request.url), 301);
   }

   if (landingOrigin && isLandingPath(pathname)) {
      return NextResponse.rewrite(new URL(pathname + search, landingOrigin));
   }

   return NextResponse.next();
};

// The policy goes on every response rather than on each branch: a rewrite or a
// redirect that returned it on its own is exactly how one loses the header.
const middleware = (request: NextRequest) => withPolicy(route(request));

// everything but the fingerprinted build output: narrowing this further is how
// api routes, 404s and error pages ship without a policy
export const config = {
   matcher: ["/((?!_next/static|_next/image).*)"],
};

export default middleware;
