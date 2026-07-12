import { NextRequest } from "next/server";
import { DELETE_otherCharge, GET_otherCharges, POST_otherCharge } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_otherCharges(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_otherCharge(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_otherCharge(req, ctx);
}
