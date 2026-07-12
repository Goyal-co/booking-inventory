import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/** Serves locally stored private files when STORAGE_PROVIDER=local */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const key = segments.join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const baseDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), "storage");
  const fullPath = path.join(baseDir, key);

  try {
    const buffer = await readFile(fullPath);
    const ext = path.extname(key).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
