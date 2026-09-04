import { NextRequest } from "next/server";
import { POST_blocks } from "@/lib/logged-handlers";

export async function POST(req: NextRequest) {
  return POST_blocks(req);
}
