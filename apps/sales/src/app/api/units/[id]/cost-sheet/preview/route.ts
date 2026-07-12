import { NextRequest } from "next/server";
import { POST_unit_costSheetPreview } from "@/lib/api-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_unit_costSheetPreview(req, ctx);
}
