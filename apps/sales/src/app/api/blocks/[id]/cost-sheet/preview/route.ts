import { NextRequest } from "next/server";
import { POST_block_costSheetPreview } from "@/lib/api-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_block_costSheetPreview(req, ctx);
}
