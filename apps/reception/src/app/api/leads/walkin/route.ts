import { NextRequest } from "next/server";
import { POST_walkInLead } from "@/lib/api-handlers";

export async function POST(req: NextRequest) {
  return POST_walkInLead(req);
}
