import { NextRequest } from "next/server";
import { GET_visitsToday } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_visitsToday(req);
}
