import { NextRequest } from "next/server";
import { GET_bookings } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_bookings(req);
}
