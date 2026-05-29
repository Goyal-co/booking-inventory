import { NextRequest } from "next/server";
import { POST_bookings } from "@/lib/api-handlers";

export async function POST(req: NextRequest) {
  return POST_bookings(req);
}
