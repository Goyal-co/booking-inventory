import { NextRequest } from "next/server";
import { GET_unit } from "@/lib/logged-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_unit(req, ctx);
}
