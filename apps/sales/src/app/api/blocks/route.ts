import { NextRequest } from "next/server";
import { POST_blocks } from "@/lib/api-handlers";

export async function POST(req: NextRequest) {
  return POST_blocks(req);
}
