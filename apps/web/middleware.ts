import { landingOrigin } from "@/lib/env";
import { LANDING_ROUTES, LEGACY_REDIRECTS } from "@/lib/site-config";
import { NextRequest, NextResponse } from "next/server";

const LANDING_PATHS = new Set(LANDING_ROUTES);
const LANDING_SECTIONS = LANDING_ROUTES.filter((route) => route !== "/");

const isLandingPath = (pathname: string) =>
   LANDING_PATHS.has(pathname) ||
   pathname.startsWith("/landing/") ||
   LANDING_SECTIONS.some((route) => pathname.startsWith(`${route}/`));

const middleware = (request: NextRequest) => {
   const { pathname, search } = request.nextUrl;

   if (pathname === "/sitemap.xml") {
      return NextResponse.rewrite(new URL("/api/sitemap", request.url));
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

export const config = {
   matcher: [
      "/sitemap.xml",
      "/landing/:path*",
      "/((?!_next/|api/|landing/|.*\\.[^/]+$).*)",
   ],
};

export default middleware;
