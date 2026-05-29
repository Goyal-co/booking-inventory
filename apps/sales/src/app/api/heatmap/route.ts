import { NextRequest } from "next/server";
import { GET_heatmap } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_heatmap(req);
}
