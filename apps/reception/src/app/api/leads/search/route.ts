import { NextRequest } from "next/server";
import { GET_leadsSearch } from "@/lib/api-handlers";

/** Hard ceiling — search aborts external CRM/EOI well before this. */
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  return GET_leadsSearch(req);
}
