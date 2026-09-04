import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@booking/logger";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/") && !path.startsWith("/api/auth")) {
    logger.debug("customer.api", "request", { method: req.method, path });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
