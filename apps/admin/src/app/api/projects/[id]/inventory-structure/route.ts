import { NextRequest } from "next/server";
import { GET_inventoryStructure } from "@/lib/api-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_inventoryStructure(req, ctx);
}
