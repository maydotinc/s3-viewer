import { NextRequest, NextResponse } from "next/server";

function middleware(request: NextRequest) {
   // clone the request url
   const url = request.nextUrl.clone();

   // get pathname of request [/cool]
   const { pathname } = request.nextUrl;

   // rewrite '/' to 'crayo-lp.vercel.app'
   if (pathname === "/") {
      url.hostname = "s3-viewer.onrender.com";
      url.protocol = "https";
      url.port = "";

      return NextResponse.rewrite(url.toString());
   }

   if (
      pathname.startsWith("/tos") ||
      pathname.startsWith("/terms-conditions")
   ) {
      url.hostname = "s3-viewer.onrender.com";
      url.protocol = "https";
      url.port = "";
      url.pathname = "/tos";

      return NextResponse.rewrite(url.toString());
   }

   if (pathname === "/privacy" || pathname.startsWith("/privacy-policy")) {
      url.hostname = "s3-viewer.onrender.com";
      url.protocol = "https";
      url.port = "";
      url.pathname = "/privacy-policy";

      return NextResponse.rewrite(url.toString());
   }

   if (pathname === "/dashboard") {
      url.pathname = "/";
      return NextResponse.rewrite(url.toString());
   }
}

export default middleware;
