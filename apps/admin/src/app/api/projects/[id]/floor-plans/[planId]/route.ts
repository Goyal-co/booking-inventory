import { NextRequest } from "next/server";
import { PATCH_floorPlan } from "@/lib/api-handlers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; planId: string }> }) {
  return PATCH_floorPlan(req, ctx);
}
