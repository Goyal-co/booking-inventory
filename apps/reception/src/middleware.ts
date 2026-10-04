import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/** Same-origin redirect using the browser Host (not AUTH_URL/sales). */
function redirectSameOrigin(req: NextRequest, pathname: string) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl.protocol.replace(":", "") || "https");
  const origin = host ? `${proto}://${host}` : req.nextUrl.origin;
  return NextResponse.redirect(new URL(pathname, origin));
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");
  const isDashboard = path.startsWith("/dashboard");
  const isApiAuth = path.startsWith("/api/auth");
  const role = req.auth?.user?.role;

  if (isApiAuth) return NextResponse.next();

  if (!isLoggedIn && isDashboard) {
    return redirectSameOrigin(req, "/login");
  }

  if (isLoggedIn && isLoginPage) {
    return redirectSameOrigin(req, "/dashboard");
  }

  if (isLoggedIn && isDashboard && role !== "RECEPTION") {
    return redirectSameOrigin(req, "/login?error=unauthorized");
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/login", "/api/auth/:path*"],
};
