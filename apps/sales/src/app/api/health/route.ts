import { NextResponse } from "next/server";
import { getCustomerUrlStatus } from "@booking/database";

/** Lightweight config check for Render deploys (no secrets). */
export async function GET() {
  const customer = getCustomerUrlStatus();
  return NextResponse.json({
    ok: true,
    service: "sales",
    customerUrl: customer,
  });
}
