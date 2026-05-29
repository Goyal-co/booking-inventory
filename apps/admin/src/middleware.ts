import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["SUPER_ADMIN", "PROJECT_ADMIN"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

  if (isApiAuth) return NextResponse.next();

  if (!isLoggedIn && isAdminRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (isLoggedIn && isAdminRoute) {
    const role = req.auth?.user?.role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
