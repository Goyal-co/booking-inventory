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

/** EOI pattern: presign → upload bytes from browser → return permanent fileUrl (never signed). */
export async function uploadViaPresign(
  token: string,
  file: File,
  type: BookingDocType
): Promise<UploadedFileResult> {
  const presignRes = await fetch(`/api/booking/${token}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
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
      contentType: file.type,
    });
    return {
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  }

  if (!config.uploadUrl || !config.fileUrl) {
    throw new Error("Invalid upload configuration");
  }

  const putRes = await fetch(config.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) throw new Error("Failed to upload file to storage");

  return {
    fileUrl: config.fileUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}
