import { NextRequest } from "next/server";
import { GET_bookingFormTemplate, POST_bookingFormTemplate } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_bookingFormTemplate(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_bookingFormTemplate(req, ctx);
}
