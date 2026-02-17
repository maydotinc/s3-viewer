import { NextRequest, NextResponse } from "next/server";

function middleware(request: NextRequest) {
   const url = request.nextUrl.clone();
   const { pathname } = request.nextUrl;

   if (pathname === "/sitemap.xml") {
      url.pathname = "/api/sitemap";
      return NextResponse.rewrite(url.toString());
   }

   return NextResponse.next();
}

export default middleware;
