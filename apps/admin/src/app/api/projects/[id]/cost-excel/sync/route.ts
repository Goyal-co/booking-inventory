import { NextRequest } from "next/server";
import { POST_costExcelSync } from "@/lib/enterprise-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_costExcelSync(req, ctx);
}
