import { NextRequest } from "next/server";
import { GET_directLeads } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_directLeads(req);
}
