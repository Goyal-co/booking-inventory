import { NextRequest } from "next/server";
import { POST_directLeadBook } from "@/lib/api-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_directLeadBook(req, ctx);
}
