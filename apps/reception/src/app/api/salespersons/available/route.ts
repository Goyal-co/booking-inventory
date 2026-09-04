import { GET_availableSalespersons } from "@/lib/logged-handlers";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return GET_availableSalespersons(req);
}
