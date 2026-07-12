import { NextRequest } from "next/server";
import { POST_seedCostSheetTemplates } from "@/lib/enterprise-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_seedCostSheetTemplates(req, ctx);
}
