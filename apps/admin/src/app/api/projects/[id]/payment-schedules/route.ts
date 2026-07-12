import { NextRequest } from "next/server";
import {
  DELETE_paymentSchedule,
  GET_paymentSchedules,
  POST_paymentSchedule,
} from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_paymentSchedules(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST_paymentSchedule(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_paymentSchedule(req, ctx);
}
