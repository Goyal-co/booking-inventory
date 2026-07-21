import { uploadFile } from "@goyal/storage";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export async function saveLogoAsset(file: File): Promise<{ url: string; key: string }> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Logo must be JPEG, PNG, WebP, GIF, or SVG");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Logo too large (max 5MB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadFile("booking-form-logos", file.name, buffer, file.type);
}
