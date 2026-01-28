import { nextCookies } from "better-auth/next-js";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get("better-auth.session_token") ||
        request.cookies.get("__secure-better-auth.session_token");

    const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
    const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
        request.nextUrl.pathname.startsWith("/signup") ||
        request.nextUrl.pathname.startsWith("/forgot-password");

    if (isDashboard && !sessionCookie) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isAuthPage && sessionCookie) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/login", "/signup", "/forgot-password"],
};
