import { NextRequest } from "next/server";
import { PATCH_directLeadFeedback } from "@/lib/logged-handlers";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return PATCH_directLeadFeedback(req, ctx);
}
