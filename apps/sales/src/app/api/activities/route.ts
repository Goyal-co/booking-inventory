import { NextRequest } from "next/server";
import { GET_activities } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_activities(req);
}
