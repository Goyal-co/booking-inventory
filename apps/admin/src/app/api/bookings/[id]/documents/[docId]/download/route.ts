import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookingDocumentForAdmin } from "@booking/database";
import { getPresignedDownloadUrl } from "@goyal/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookingId, docId } = await params;
  const document = await getBookingDocumentForAdmin(bookingId, docId);
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
    console.error("Admin booking document download URL failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get download URL" },
      { status: 500 }
    );
  }
}
