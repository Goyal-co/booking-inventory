import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@booking/database";

function verifyWebhook(req: Request, rawBody: string) {
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret === secret) return true;

  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");
  if (!signature || !timestamp) return false;

  const age = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (age > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyWebhook(req, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    postCrmId: string;
    stageName: string;
    amountDue?: number;
    amountPaid?: number;
    paidAt?: string;
    idempotencyKey?: string;
  };

  const { postCrmId, stageName, amountDue, amountPaid, paidAt, idempotencyKey } = body;
  if (!postCrmId || !stageName) {
    return NextResponse.json({ error: "postCrmId and stageName required" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({ where: { postCrmId } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const recordId = idempotencyKey ?? `${booking.id}-${stageName}`;

  await prisma.paymentRecord.upsert({
    where: { id: recordId },
    create: {
      id: recordId,
      bookingId: booking.id,
      customerId: booking.customerId,
      stageName: String(stageName),
      amountDue: Number(amountDue ?? 0),
      amountPaid: Number(amountPaid ?? 0),
      paidAt: paidAt ? new Date(paidAt) : null,
      postCrmRef: postCrmId,
    },
    update: {
      amountPaid: Number(amountPaid ?? 0),
      paidAt: paidAt ? new Date(paidAt) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
