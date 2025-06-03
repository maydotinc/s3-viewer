import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
 
export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);
	
	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/connect", request.url));
	}
 
	return NextResponse.next();
}
 
export const config = {
	// Need to exclude logo.png from middleware for some reason
	matcher: ["/((?!api|connect|logo.png|_next/static|_next/image|favicon.ico).*)"], // Simplified matcher
};