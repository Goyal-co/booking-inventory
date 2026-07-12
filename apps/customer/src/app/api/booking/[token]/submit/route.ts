import { NextResponse } from "next/server";
import { submitDigitalForm, BookingError } from "@booking/database";
import { isTokenVerified } from "@/lib/otp";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isTokenVerified(token)) {
    return NextResponse.json({ error: "OTP verification required" }, { status: 401 });
  }

  try {
    const booking = await submitDigitalForm(token);
    if (!booking) return NextResponse.json({ error: "Unable to submit" }, { status: 400 });
    return NextResponse.json({ ok: true, bookingId: booking.id, status: booking.status });
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
