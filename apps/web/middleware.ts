import { NextRequest, NextResponse } from "next/server";

function middleware(request: NextRequest) {
   // clone the request url
   const url = request.nextUrl.clone();

   // get pathname of request [/cool]
   const { pathname } = request.nextUrl;

   const isProd = process.env.NODE_ENV === "production";
   const landingOrigin = {
      hostname: isProd ? "s3-viewer-lp.vercel.app" : "localhost",
      protocol: isProd ? "https" : "http",
      port: isProd ? "" : "3001",
   };

   // Rewrite /landing/* to the landing origin for CSS url() references
   if (pathname.startsWith("/landing/")) {
      url.hostname = landingOrigin.hostname;
      url.protocol = landingOrigin.protocol;
      url.port = landingOrigin.port;
      return NextResponse.rewrite(url.toString());
   }

   if (pathname === "/sitemap.xml") {
      url.pathname = "/api/sitemap";
      return NextResponse.rewrite(url.toString());
   }

   if (pathname === "/") {
      url.hostname = landingOrigin.hostname;
      url.protocol = landingOrigin.protocol;
      url.port = landingOrigin.port;

      return NextResponse.rewrite(url.toString());
   }

   if (
      pathname.startsWith("/tos") ||
      pathname.startsWith("/terms-conditions")
   ) {
      url.hostname = landingOrigin.hostname;
      url.protocol = landingOrigin.protocol;
      url.port = landingOrigin.port;
      url.pathname = "/tos";

      return NextResponse.rewrite(url.toString());
   }

   if (pathname === "/privacy" || pathname.startsWith("/privacy-policy")) {
      url.hostname = landingOrigin.hostname;
      url.protocol = landingOrigin.protocol;
      url.port = landingOrigin.port;
      url.pathname = "/privacy-policy";

      return NextResponse.rewrite(url.toString());
   }

   if (pathname.startsWith("/brand-kit")) {
      url.hostname = landingOrigin.hostname;
      url.protocol = landingOrigin.protocol;
      url.port = landingOrigin.port;
      url.pathname = "/brand-kit";

      return NextResponse.rewrite(url.toString());
   }

   return NextResponse.next();
}

export default middleware;
