import { NextRequest } from "next/server";
import { POST_integrationRetry } from "@/lib/enterprise-handlers";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ logId: string }> }) {
  return POST_integrationRetry(_req, ctx);
}
