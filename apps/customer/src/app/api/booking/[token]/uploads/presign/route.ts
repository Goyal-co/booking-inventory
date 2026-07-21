import { NextResponse } from "next/server";
import { getDigitalFormByToken } from "@booking/database";
import {
  getPresignedUpload,
  validateBookingDocument,
  type BookingDocType,
} from "@goyal/storage";

const ALLOWED = new Set<BookingDocType>([
  "PAN",
  "AADHAAR",
  "SIGNATURE",
  "PAYMENT_PROOF",
  "OTHER",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const form = await getDigitalFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 404 });
  }
  if (form.status !== "DRAFT") {
    return NextResponse.json({ error: "Booking form is no longer editable" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      fileName?: string;
      mimeType?: string;
      type?: string;
      size?: number;
    };
    const fileName = String(body.fileName ?? "").trim();
    const mimeType = String(body.mimeType ?? "").trim();
    const type = String(body.type ?? "OTHER") as BookingDocType;
    const size = Number(body.size ?? 0);

    if (!fileName || !mimeType) {
      return NextResponse.json({ error: "fileName and mimeType are required" }, { status: 400 });
    }
    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    const validationError = validateBookingDocument(type, mimeType, size);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const result = await getPresignedUpload({
      fileName,
      mimeType,
      size,
      folder: `booking-docs/${token.slice(0, 12)}/${type.toLowerCase()}`,
      appOrigin: origin,
      localUploadPath: `/api/booking/${token}/uploads/put`,
    });

    if (result.mode === "blob") {
      return NextResponse.json({
        ...result,
        handleUploadUrl: `/api/booking/${token}/uploads/blob`,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Booking document presign failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
