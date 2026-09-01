import { NextRequest } from "next/server";
import { POST_costExcelExtract } from "@/lib/enterprise-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_costExcelExtract(req, ctx);
}
