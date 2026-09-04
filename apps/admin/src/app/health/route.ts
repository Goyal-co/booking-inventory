import { prisma } from "@booking/database";
import { runBookingHealthCheck } from "@goyal/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return runBookingHealthCheck(req, "admin", prisma);
}

export async function HEAD(req: Request) {
  const res = await runBookingHealthCheck(req, "admin", prisma);
  return new Response(null, {
    status: res.status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
