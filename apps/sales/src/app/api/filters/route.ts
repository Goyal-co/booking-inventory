import { NextRequest } from "next/server";
import { GET_filters } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_filters(req);
}
