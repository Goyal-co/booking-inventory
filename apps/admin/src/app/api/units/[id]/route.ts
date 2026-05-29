import { NextRequest } from "next/server";
import { PATCH_unit, DELETE_unit } from "@/lib/api-handlers";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_unit(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_unit(req, ctx);
}
