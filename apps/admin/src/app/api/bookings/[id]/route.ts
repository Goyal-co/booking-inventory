import { NextRequest } from "next/server";
import { DELETE_booking, PATCH_booking } from "@/lib/api-handlers";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_booking(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_booking(req, ctx);
}
