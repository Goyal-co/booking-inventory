import type { BookingDocType } from "@goyal/storage";

export interface PresignResponse {
  mode: "blob" | "s3" | "local";
  pathname?: string;
  handleUploadUrl?: string;
  uploadUrl?: string;
  fileUrl?: string;
  key?: string;
}

export interface UploadedFileResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

function guessMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/** EOI pattern: presign → upload bytes from browser → return permanent fileUrl (never signed). */
export async function uploadViaPresign(
  token: string,
  file: File,
  type: BookingDocType
): Promise<UploadedFileResult> {
  const mimeType = guessMimeType(file);
  if (mimeType === "application/octet-stream") {
    throw new Error("Unsupported file type. Use PDF, JPEG, PNG, or WebP.");
  }

  const presignRes = await fetch(`/api/booking/${token}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      type,
      size: file.size,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : "Failed to prepare upload"
    );
  }

  const config = (await presignRes.json()) as PresignResponse;

  if (config.mode === "blob") {
    if (!config.pathname) throw new Error("Invalid blob upload configuration");
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(config.pathname, file, {
      access: "private",
      handleUploadUrl: config.handleUploadUrl || `/api/booking/${token}/uploads/blob`,
      contentType: mimeType,
    });
    return {
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    };
  }

  if (!config.uploadUrl || !config.fileUrl) {
    throw new Error("Invalid upload configuration");
  }

  const putRes = await fetch(config.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": mimeType },
  });
  if (!putRes.ok) throw new Error("Failed to upload file to storage");

  return {
    fileUrl: config.fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType,
  };
}
