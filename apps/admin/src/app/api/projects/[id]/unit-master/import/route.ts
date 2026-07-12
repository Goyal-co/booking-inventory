import { NextRequest } from "next/server";
import { POST_unitMasterImport } from "@/lib/enterprise-handlers";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_unitMasterImport(req, ctx);
}
