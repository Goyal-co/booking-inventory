import { NextRequest } from "next/server";
import { POST_materializeTitanLead } from "@/lib/logged-handlers";

export async function POST(req: NextRequest) {
  return POST_materializeTitanLead(req);
}
