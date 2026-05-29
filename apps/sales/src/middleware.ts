import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SALES_ROLES = ["SALES_EXEC", "SALES_MANAGER"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isAppRoute = req.nextUrl.pathname.startsWith("/app");

  if (isApiAuth) return NextResponse.next();

  if (!isLoggedIn && isAppRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  if (isLoggedIn && isAppRoute) {
    const role = req.auth?.user?.role;
    if (!role || !SALES_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/login"],
};
