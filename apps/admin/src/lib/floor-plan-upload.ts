import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PDF_TYPE = "application/pdf";

function publicDirs() {
  const adminDir = path.join(process.cwd(), "public", "uploads", "floor-plans");
  const salesDir = path.join(process.cwd(), "..", "sales", "public", "uploads", "floor-plans");
  return [adminDir, salesDir];
}

async function writeToPublicDirs(filename: string, buffer: Buffer) {
  for (const dir of publicDirs()) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
  }
}

export async function saveFloorPlanAsset(
  file: File,
  kind: "image" | "pdf"
): Promise<{ url: string; filename: string }> {
  const isPdf = kind === "pdf";
  if (isPdf && file.type !== PDF_TYPE) {
    throw new Error("Floor plan PDF must be a PDF file");
  }
  if (!isPdf && !IMAGE_TYPES.has(file.type)) {
    throw new Error("Floor plan image must be JPEG, PNG, WebP, or GIF");
  }

  const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
  }

  const ext = isPdf ? "pdf" : file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeToPublicDirs(filename, buffer);

  return { url: `/uploads/floor-plans/${filename}`, filename };
}
