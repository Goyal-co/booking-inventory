import { NextResponse } from "next/server";
import { getLeadBookingStatus } from "@booking/database";

function verifySecret(req: Request) {
  const secret = req.headers.get("x-integration-secret");
  const expected = process.env.INTEGRATION_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" && secret !== expected) return false;
  return true;
}

export async function GET(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await params;
  const status = await getLeadBookingStatus(leadId);
  if (!status) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(status);
}
