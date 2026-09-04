import { NextRequest } from "next/server";
import { GET_myBlocks } from "@/lib/logged-handlers";

export async function GET(req: NextRequest) {
  return GET_myBlocks(req);
}
