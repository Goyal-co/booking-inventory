import { NextRequest } from "next/server";
import { GET_bookingDigitalForm } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_bookingDigitalForm(req, ctx);
}
