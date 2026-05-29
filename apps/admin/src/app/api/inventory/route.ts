import { NextRequest } from "next/server";
import { POST_generateInventory, POST_bulkAssign, POST_massBlock } from "@/lib/api-handlers";

export async function POST(req: NextRequest) {
  const body = await req.clone().json();
  if (body.type === "generate") return POST_generateInventory(req);
  if (body.type === "assign") return POST_bulkAssign(req);
  if (body.type === "mass-block") return POST_massBlock(req);
  return new Response("Invalid type", { status: 400 });
}
