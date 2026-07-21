import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveLogoAsset } from "@/lib/logo-upload";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["SUPER_ADMIN", "PROJECT_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const result = await saveLogoAsset(file);
    // Local storage returns /api/files/...; persist an absolute admin URL so
    // sales/customer PDF renderers can fetch the same logo too. S3 URLs pass through.
    const url = result.url.startsWith("/")
      ? new URL(result.url, req.nextUrl.origin).toString()
      : result.url;
    return NextResponse.json({ ...result, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
