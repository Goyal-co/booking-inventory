import { NextRequest } from "next/server";
import { POST_costSheet } from "@/lib/api-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_costSheet(req, ctx);
}
