import { NextResponse } from "next/server";
import { verifyOtp, markTokenVerified } from "@/lib/otp";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { otp } = await req.json();
  if (!otp || String(otp).length !== 6) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  if (!verifyOtp(token, String(otp))) {
    return NextResponse.json({ error: "Incorrect or expired OTP" }, { status: 401 });
  }

  markTokenVerified(token);
  return NextResponse.json({ verified: true });
}
