import { NextRequest } from "next/server";
import { GET_dashboard } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_dashboard(req);
}
