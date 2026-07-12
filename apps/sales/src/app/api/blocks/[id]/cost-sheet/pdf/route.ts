import { NextRequest } from "next/server";
import { GET_block_costSheetPdf } from "@/lib/api-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_block_costSheetPdf(req, ctx);
}
