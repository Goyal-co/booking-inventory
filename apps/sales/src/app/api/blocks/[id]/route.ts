import { NextRequest } from "next/server";
import { DELETE_blocks } from "@/lib/api-handlers";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_blocks(req, ctx);
}
