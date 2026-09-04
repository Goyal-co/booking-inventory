import { NextRequest } from "next/server";
import { POST_assignLead } from "@/lib/logged-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_assignLead(req, ctx);
}
