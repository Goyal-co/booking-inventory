import { GET_audit } from "@/lib/api-handlers";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return GET_audit(req);
}
