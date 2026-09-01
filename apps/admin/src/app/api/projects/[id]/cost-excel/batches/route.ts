import { NextRequest } from "next/server";
import { GET_costExcelBatches } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_costExcelBatches(req, ctx);
}
