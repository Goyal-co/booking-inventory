import { NextRequest } from "next/server";
import { GET_bookings, GET_dashboard } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  if (req.nextUrl.pathname.endsWith("/dashboard")) return GET_dashboard(req);
  return GET_bookings(req);
}
