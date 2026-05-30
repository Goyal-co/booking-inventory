import { NextRequest } from "next/server";
import { DELETE_floorPlan, PATCH_floorPlan } from "@/lib/api-handlers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; planId: string }> }) {
  return PATCH_floorPlan(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; planId: string }> }) {
  return DELETE_floorPlan(req, ctx);
}
