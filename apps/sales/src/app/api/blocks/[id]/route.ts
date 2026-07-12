import { NextRequest } from "next/server";
import { DELETE_blocks, GET_block_detail, PATCH_block_detail } from "@/lib/api-handlers";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_block_detail(_req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH_block_detail(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_blocks(req, ctx);
}
