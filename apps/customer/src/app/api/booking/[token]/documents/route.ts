import { NextResponse } from "next/server";
import { addBookingDocument } from "@booking/database";
import { uploadFile } from "@goyal/storage";

const ALLOWED_TYPES = new Set(["PAN", "AADHAAR", "SIGNATURE", "OTHER"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = (formData.get("type") as string) ?? "OTHER";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadFile("booking-docs", file.name, buffer, file.type || "application/octet-stream");

  const doc = await addBookingDocument(
    token,
    type as "PAN" | "AADHAAR" | "SIGNATURE" | "OTHER",
    file.name,
    uploaded.url
  );
  if (!doc) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
  return NextResponse.json({ document: doc }, { status: 201 });
}
