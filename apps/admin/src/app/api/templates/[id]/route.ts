import { NextRequest } from "next/server";
import {
  GET_orgBookingFormTemplate,
  PUT_orgBookingFormTemplate,
  DELETE_orgBookingFormTemplate,
} from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return GET_orgBookingFormTemplate(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PUT_orgBookingFormTemplate(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return DELETE_orgBookingFormTemplate(req, ctx);
}
