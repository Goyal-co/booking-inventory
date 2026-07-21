export type StorageMode = "blob" | "s3" | "local";

/** Same priority as EOI: Vercel Blob → S3/MinIO → local disk (dev). */
export function getStorageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (
    process.env.S3_ACCESS_KEY?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    process.env.STORAGE_PROVIDER === "s3"
  ) {
    return "s3";
  }
  return "local";
}

export function isBlobUrl(fileUrl: string): boolean {
  return fileUrl.includes("blob.vercel-storage.com");
}

export function storageConfiguredForCloud(): boolean {
  const mode = getStorageMode();
  return mode === "blob" || mode === "s3";
}

export function getS3Config() {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION || "ap-south-1",
    bucket: process.env.S3_BUCKET || "goyal-booking-documents",
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: process.env.S3_PUBLIC_URL?.replace(/\/+$/, "") || undefined,
  };
}
