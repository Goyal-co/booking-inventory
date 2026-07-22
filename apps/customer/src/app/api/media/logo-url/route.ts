import { NextRequest, NextResponse } from "next/server";
import { resolveMediaDisplayUrl } from "@goyal/storage";

/**
 * Public logo display resolver for customer booking forms.
 * Only allows known logo/storage URL shapes (not arbitrary open proxy).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const allowed =
    raw.startsWith("/") ||
    raw.includes("blob.vercel-storage.com") ||
    raw.includes("/api/files/") ||
    raw.includes("booking-form-logos") ||
    /drive\.google\.com/i.test(raw) ||
    /dropbox\.com/i.test(raw) ||
    /^https?:\/\//i.test(raw);

  if (!allowed) {
    return NextResponse.json({ error: "Unsupported media URL" }, { status: 400 });
  }

  try {
    const displayUrl = await resolveMediaDisplayUrl(raw, {
      baseOrigin: req.nextUrl.origin,
    });
    return NextResponse.json({ displayUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve media URL" },
      { status: 500 }
    );
  }
}
