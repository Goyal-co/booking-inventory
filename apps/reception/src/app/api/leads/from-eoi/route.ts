import { NextRequest } from "next/server";
import { POST_materializeEoiLead } from "@/lib/logged-handlers";

export async function POST(req: NextRequest) {
  return POST_materializeEoiLead(req);
}
