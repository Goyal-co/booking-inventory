import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveMediaDisplayUrl } from "@goyal/storage";

/** Returns a short-lived display URL for template logos (admin preview / editor). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
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
