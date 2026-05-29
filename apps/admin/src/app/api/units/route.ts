import { NextRequest } from "next/server";
import { GET_units, POST_unit } from "@/lib/api-handlers";

export async function GET(req: NextRequest) {
  return GET_units(req);
}

export async function POST(req: NextRequest) {
  return POST_unit(req);
}
