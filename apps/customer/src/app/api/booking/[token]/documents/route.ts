import { NextResponse } from "next/server";
import { addBookingDocument, getDigitalFormByToken } from "@booking/database";
import {
  deleteStoredObject,
  objectExists,
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

/** EOI-style: metadata only after client upload. Never accept multipart bytes here. */
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
      type?: string;
      fileName?: string;
      fileUrl?: string;
      mimeType?: string;
      fileSize?: number;
    };

    const type = String(body.type ?? "OTHER") as BookingDocType;
    const fileName = String(body.fileName ?? "").trim();
    const fileUrl = String(body.fileUrl ?? "").trim();
    const mimeType = String(body.mimeType ?? "").trim();
    const fileSize = Number(body.fileSize ?? 0);

    if (!ALLOWED.has(type)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }
    if (!fileName || !fileUrl) {
      return NextResponse.json({ error: "fileName and fileUrl are required" }, { status: 400 });
    }
    if (mimeType) {
      const validationError = validateBookingDocument(type, mimeType, fileSize || 1);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    const exists = await objectExists(fileUrl);
    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file not found. Please upload again." },
        { status: 400 }
      );
    }

    const result = await addBookingDocument(token, type, fileName, fileUrl);
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 404 });
    }

    if (result.replacedFileUrl && result.replacedFileUrl !== fileUrl) {
      try {
        await deleteStoredObject(result.replacedFileUrl);
      } catch {
        /* best-effort cleanup */
      }
    }

    return NextResponse.json({ document: result.doc }, { status: 201 });
  } catch (error) {
    console.error("Booking document metadata save failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document save failed" },
      { status: 500 }
    );
  }
}
