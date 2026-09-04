import { NextRequest } from "next/server";
import { GET_eoiLeads, POST_eoiLead } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_eoiLeads(req);
}

export async function POST(req: NextRequest) {
  return POST_eoiLead(req);
}
