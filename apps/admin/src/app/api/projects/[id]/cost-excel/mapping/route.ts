import { NextRequest } from "next/server";
import { GET_costExcelMapping, PUT_costExcelMapping } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_costExcelMapping(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PUT_costExcelMapping(req, ctx);
}
