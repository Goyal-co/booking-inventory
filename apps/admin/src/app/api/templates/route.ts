import { NextRequest } from "next/server";
import {
  GET_orgBookingFormTemplates,
  POST_orgBookingFormTemplate,
} from "@/lib/enterprise-handlers";

export async function GET(req: NextRequest) {
  return GET_orgBookingFormTemplates(req);
}

export async function POST(req: NextRequest) {
  return POST_orgBookingFormTemplate(req);
}
