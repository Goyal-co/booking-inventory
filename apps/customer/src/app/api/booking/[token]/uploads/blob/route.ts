import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getDigitalFormByToken } from "@booking/database";
import { getStorageMode, MAX_BOOKING_DOC_BYTES } from "@goyal/storage";

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (getStorageMode() !== "blob") {
    return NextResponse.json({ error: "Blob uploads are not enabled" }, { status: 400 });
  }

  const { token } = await params;
  const form = await getDigitalFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 404 });
  }
  if (form.status !== "DRAFT") {
    return NextResponse.json({ error: "Booking form is no longer editable" }, { status: 400 });
  }

  const body = (await request.json()) as HandleUploadBody;
  const tokenPrefix = `booking-docs/${token.slice(0, 12)}/`;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(tokenPrefix)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_MIME,
          maximumSizeInBytes: MAX_BOOKING_DOC_BYTES,
          validUntil: Date.now() + 60_000,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ bookingToken: token.slice(0, 12) }),
        };
      },
      onUploadCompleted: async () => {
        // Metadata is saved by the client after upload completes.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
