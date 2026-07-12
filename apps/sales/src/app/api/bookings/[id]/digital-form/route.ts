import { NextRequest } from "next/server";
import { GET_booking_digitalForm } from "@/lib/api-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_booking_digitalForm(req, ctx);
}
