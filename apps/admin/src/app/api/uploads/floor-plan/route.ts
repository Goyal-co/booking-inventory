import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveFloorPlanAsset } from "@/lib/floor-plan-upload";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["SUPER_ADMIN", "PROJECT_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = form.get("kind");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (kind !== "image" && kind !== "pdf") {
      return NextResponse.json({ error: "kind must be image or pdf" }, { status: 400 });
    }

    const result = await saveFloorPlanAsset(file, kind);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
