import { NextRequest } from "next/server";
import { GET_leadsSearch } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_leadsSearch(req);
}
