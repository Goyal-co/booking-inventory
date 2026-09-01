import { NextRequest } from "next/server";
import {
  DELETE_costSheetLine,
  GET_costSheetLines,
  POST_costSheetLine,
} from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_costSheetLines(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_costSheetLine(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_costSheetLine(req, ctx);
}
