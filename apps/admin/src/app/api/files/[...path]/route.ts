import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/** Serves locally stored uploaded logos. Production should use S3 storage. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const key = segments.join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const baseDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), "storage");
  try {
    const buffer = await readFile(path.join(baseDir, key));
    const ext = path.extname(key).toLowerCase();
    const contentType =
      ext === ".svg"
        ? "image/svg+xml"
        : ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
