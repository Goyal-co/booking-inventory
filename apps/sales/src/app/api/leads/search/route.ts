import { NextRequest } from "next/server";
import { GET_leads_search } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_leads_search(req);
}
