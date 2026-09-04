import { NextRequest } from "next/server";
import { POST_eoiSiteVisit } from "@/lib/logged-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_eoiSiteVisit(req, ctx);
}
