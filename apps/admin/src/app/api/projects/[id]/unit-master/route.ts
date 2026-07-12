import { NextRequest } from "next/server";
import {
  DELETE_unitMasterRow,
  GET_unitMaster,
  POST_unitMasterRow,
} from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_unitMaster(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_unitMasterRow(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_unitMasterRow(req, ctx);
}
