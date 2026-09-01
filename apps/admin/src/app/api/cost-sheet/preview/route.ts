import { NextRequest } from "next/server";
import { POST_costSheetCalculate } from "@/lib/enterprise-handlers";

export async function POST(req: NextRequest) {
  return POST_costSheetCalculate(req);
}
