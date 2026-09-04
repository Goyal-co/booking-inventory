import { NextRequest } from "next/server";
import { GET_eoiMyLeads } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_eoiMyLeads(req);
}
