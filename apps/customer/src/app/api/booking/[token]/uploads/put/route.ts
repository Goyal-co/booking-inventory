import { NextResponse } from "next/server";
import { getDigitalFormByToken } from "@booking/database";
import { getStorageMode, putLocalObject } from "@goyal/storage";

/** Local-dev PUT target (EOI has no local mode; Booking keeps this for localhost). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (getStorageMode() !== "local") {
    return NextResponse.json({ error: "Local uploads are not enabled" }, { status: 400 });
  }

  const form = await getDigitalFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: "Invalid or expired booking link" }, { status: 404 });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || key.includes("..") || !key.startsWith("booking-docs/")) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  try {
    const uploaded = await putLocalObject(key, buffer, contentType);
    const fileUrl = uploaded.url.startsWith("/")
      ? new URL(uploaded.url, req.url).toString()
      : uploaded.url;
    return NextResponse.json({ ok: true, fileUrl, key: uploaded.key });
  } catch (error) {
    console.error("Local booking document PUT failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
