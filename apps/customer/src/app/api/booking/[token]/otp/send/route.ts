import { NextResponse } from "next/server";
import { prisma } from "@booking/database";
import { generateOtp } from "@/lib/otp";
import { sendEmail, otpVerificationEmail } from "@booking/email";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const block = await prisma.block.findFirst({
    where: { bookingToken: token },
    include: { unit: { include: { floor: { include: { tower: { include: { project: true } } } } } } },
  });
  if (!block || block.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  }
  if (!block.customerEmail) {
    return NextResponse.json({ error: "No email on file" }, { status: 400 });
  }

  const otp = generateOtp(token);
  const projectName = block.unit.floor.tower.project.name;
  const { subject, html } = otpVerificationEmail({ otp, projectName });
  const emailResult = await sendEmail({
    to: block.customerEmail,
    subject,
    html,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      {
        error: emailResult.mocked
          ? "Email not sent — BREVO_API_KEY not loaded. Restart the customer app after saving .env.local"
          : emailResult.error || "Failed to send OTP email",
        ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    sent: true,
    mocked: !!emailResult.mocked,
    ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
  });
}
