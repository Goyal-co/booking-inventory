import { NextRequest } from "next/server";
import { PATCH_user } from "@/lib/api-handlers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_user(req, ctx);
}
