import { NextResponse } from "next/server";
import { getCustomerUrlStatus } from "@booking/database";
import { getEmailConfigStatus } from "@booking/email";

/** Lightweight config check for Render deploys (no secrets). */
export async function GET() {
  const customer = getCustomerUrlStatus();
  const email = getEmailConfigStatus();
  return NextResponse.json({
    ok: true,
    service: "sales",
    customerUrl: customer,
    email,
  });
}
