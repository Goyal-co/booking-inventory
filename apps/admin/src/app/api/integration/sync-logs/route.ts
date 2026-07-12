import { NextRequest } from "next/server";
import { GET_integrationSyncLogs } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest) {
  return GET_integrationSyncLogs(req);
}
