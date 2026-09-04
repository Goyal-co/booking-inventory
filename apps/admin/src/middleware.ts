import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { logger } from "@booking/logger";

const ADMIN_ROLES = ["SUPER_ADMIN", "PROJECT_ADMIN"];

export default auth((req) => {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/auth")) {
    logger.debug("admin.api", "request", { method: req.method, path });
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = path.startsWith("/login");
  const isApiAuth = path.startsWith("/api/auth");
  const isAdminRoute = path.startsWith("/admin");

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
  matcher: ["/admin", "/admin/:path*", "/login", "/api/:path*"],
};
