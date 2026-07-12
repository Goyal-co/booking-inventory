import { NextRequest } from "next/server";
import { GET_constructionReports, POST_constructionReport } from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_constructionReports(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_constructionReport(req, ctx);
}
