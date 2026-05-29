import { NextRequest } from "next/server";
import { DELETE_forceRelease } from "@/lib/api-handlers";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_forceRelease(req, ctx);
}
