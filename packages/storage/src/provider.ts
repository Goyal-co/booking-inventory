export type StorageMode = "blob" | "s3" | "local";

/**
 * Same priority as EOI_CP: S3 when credentials exist, Blob only for legacy reads,
 * otherwise local disk (dev).
 */
export function getStorageMode(): StorageMode {
  if (
    process.env.S3_ACCESS_KEY?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
    process.env.STORAGE_PROVIDER === "s3"
  ) {
    return "s3";
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  return "local";
}

/**
 * Root folder in the shared bucket / blob store.
 * EOI uses `eoi`; Booking uses `booking` (override with S3_PREFIX).
 */
export function getStoragePrefix(): string {
  const raw = (process.env.S3_PREFIX || process.env.BLOB_PREFIX || "booking")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return raw.replace(/[^a-zA-Z0-9._-]/g, "-") || "booking";
}

export function withStoragePrefix(relativeKey: string): string {
  const prefix = getStoragePrefix();
  const key = relativeKey.replace(/^\/+/, "");
  if (key === prefix || key.startsWith(`${prefix}/`)) return key;
  return `${prefix}/${key}`;
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
    // Same shared bucket as EOI by default; objects live under S3_PREFIX (booking).
    bucket: process.env.S3_BUCKET || "goyalco-prod-assets",
    accessKeyId: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    // Optional CDN / public base — not required; private objects use presigned URLs.
    publicBaseUrl: process.env.S3_PUBLIC_URL?.replace(/\/+$/, "") || undefined,
    prefix: getStoragePrefix(),
  };
}
