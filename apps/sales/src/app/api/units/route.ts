import { NextRequest } from "next/server";
import { GET_units } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_units(req);
}
