import { NextRequest } from "next/server";
import { GET_eoiLead } from "@/lib/api-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_eoiLead(req, ctx);
}
