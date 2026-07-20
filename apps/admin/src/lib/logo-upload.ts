import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

function publicDirs() {
  const adminDir = path.join(process.cwd(), "public", "uploads", "logos");
  const salesDir = path.join(process.cwd(), "..", "sales", "public", "uploads", "logos");
  const customerDir = path.join(process.cwd(), "..", "customer", "public", "uploads", "logos");
  return [adminDir, salesDir, customerDir];
}

async function writeToPublicDirs(filename: string, buffer: Buffer) {
  for (const dir of publicDirs()) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
  }
}

export async function saveLogoAsset(file: File): Promise<{ url: string; filename: string }> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Logo must be JPEG, PNG, WebP, GIF, or SVG");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Logo too large (max 5MB)");
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeToPublicDirs(filename, buffer);

  return { url: `/uploads/logos/${filename}`, filename };
}
