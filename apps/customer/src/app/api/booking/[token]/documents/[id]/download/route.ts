import { NextResponse } from "next/server";
import { getBookingDocumentForToken } from "@booking/database";
import { getPresignedDownloadUrl } from "@goyal/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const document = await getBookingDocumentForToken(token, id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const downloadUrl = await getPresignedDownloadUrl(document.fileUrl);
    return NextResponse.json({
      downloadUrl,
      fileName: document.fileName,
      type: document.type,
    });
  } catch (error) {
    console.error("Booking document download URL failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get download URL" },
      { status: 500 }
    );
  }
}
