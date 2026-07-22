import { randomUUID } from "crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  getS3Config,
  getStorageMode,
  isBlobUrl,
  type StorageMode,
} from "./provider";
import {
  blobDelete,
  blobGetDownloadUrl,
  blobObjectExists,
} from "./vercel-blob";

export * from "./provider";
export { blobGetDownloadUrl, blobObjectExists, blobDelete } from "./vercel-blob";

export interface UploadResult {
  key: string;
  url: string;
}

export type BookingDocType = "PAN" | "AADHAAR" | "SIGNATURE" | "PAYMENT_PROOF" | "OTHER";

export type PresignUploadResult =
  | {
      mode: "blob";
      pathname: string;
      handleUploadUrl: string;
      key: string;
    }
  | {
      mode: "s3";
      uploadUrl: string;
      fileUrl: string;
      key: string;
    }
  | {
      mode: "local";
      uploadUrl: string;
      fileUrl: string;
      key: string;
    };

const ALLOWED_MIME: Record<BookingDocType, string[]> = {
  PAN: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  AADHAAR: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  PAYMENT_PROOF: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  SIGNATURE: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  OTHER: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

export const MAX_BOOKING_DOC_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TTL_SEC = 900;

function s3Client() {
  const cfg = getS3Config();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
  return new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: cfg.forcePathStyle,
  });
}

function localBaseDir() {
  return process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), "storage");
}

function localPublicBase() {
  return process.env.STORAGE_PUBLIC_URL ?? "/api/files";
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.+/g, ".").slice(0, 200);
}

export function validateBookingDocument(
  type: BookingDocType,
  mimeType: string,
  size: number
): string | null {
  const allowed = ALLOWED_MIME[type];
  if (!allowed?.includes(mimeType)) {
    return `Invalid file type for ${type}. Use PDF, JPEG, PNG, or WebP.`;
  }
  if (size <= 0 || size > MAX_BOOKING_DOC_BYTES) {
    return "File exceeds 10MB limit";
  }
  return null;
}

export function buildObjectKey(folder: string, fileName: string): string {
  const safe = sanitizeFileName(fileName);
  return `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
}

function permanentS3FileUrl(key: string): string {
  const cfg = getS3Config();
  if (cfg.publicBaseUrl) return `${cfg.publicBaseUrl}/${key}`;
  if (cfg.endpoint) return `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${key}`;
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

/** EOI-style: client gets upload credentials, then uploads bytes directly. */
export async function getPresignedUpload(params: {
  fileName: string;
  mimeType: string;
  folder: string;
  size: number;
  /** Absolute origin for local PUT + file URL (customer app). */
  appOrigin?: string;
  /** Relative local PUT path, e.g. /api/booking/{token}/uploads/put */
  localUploadPath?: string;
}): Promise<PresignUploadResult> {
  const key = buildObjectKey(params.folder, params.fileName);
  const mode = getStorageMode();

  if (mode === "blob") {
    return {
      mode: "blob",
      pathname: key,
      handleUploadUrl: "/api/uploads/blob",
      key,
    };
  }

  if (mode === "s3") {
    const cfg = getS3Config();
    if (!cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
      throw new Error("S3 credentials are not configured");
    }
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: params.mimeType,
      ContentLength: params.size,
    });
    const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: DOWNLOAD_TTL_SEC });
    return {
      mode: "s3",
      uploadUrl,
      fileUrl: permanentS3FileUrl(key),
      key,
    };
  }

  // Local /dev: PUT to app-owned endpoint, then store permanent private-ish URL
  if (!params.localUploadPath) {
    throw new Error("localUploadPath required for local storage uploads");
  }
  const origin = (params.appOrigin || "").replace(/\/+$/, "");
  const uploadUrl = origin
    ? `${origin}${params.localUploadPath}?key=${encodeURIComponent(key)}`
    : `${params.localUploadPath}?key=${encodeURIComponent(key)}`;
  const fileUrl = origin
    ? `${origin}${localPublicBase()}/${key}`
    : `${localPublicBase()}/${key}`;

  return { mode: "local", uploadUrl, fileUrl, key };
}

export function extractKey(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  const urlWithoutQuery = fileUrl.split("?")[0]!;
  const cfg = getS3Config();
  const bucket = cfg.bucket;

  const bucketMarker = `/${bucket}/`;
  const bucketIdx = urlWithoutQuery.indexOf(bucketMarker);
  if (bucketIdx !== -1) {
    return decodeURIComponent(urlWithoutQuery.slice(bucketIdx + bucketMarker.length));
  }

  const publicBase = localPublicBase();
  const filesMarker = `${publicBase}/`;
  const filesIdx = urlWithoutQuery.indexOf(filesMarker);
  if (filesIdx !== -1) {
    return decodeURIComponent(urlWithoutQuery.slice(filesIdx + filesMarker.length));
  }

  try {
    const parsed = new URL(urlWithoutQuery);
    const host = parsed.hostname;
    if (host.startsWith(`${bucket}.`) || host === `${bucket}.s3.amazonaws.com`) {
      return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    }
    if (host.includes("s3") && parsed.pathname.length > 1) {
      const p = parsed.pathname.replace(/^\//, "");
      if (p.startsWith(`${bucket}/`)) return decodeURIComponent(p.slice(bucket.length + 1));
      return decodeURIComponent(p);
    }
    if (parsed.pathname.includes("/api/files/")) {
      return decodeURIComponent(parsed.pathname.split("/api/files/")[1] || "");
    }
  } catch {
    /* fall through */
  }

  if (!urlWithoutQuery.includes("://")) {
    return decodeURIComponent(urlWithoutQuery.replace(/^\//, "").replace(/^api\/files\//, ""));
  }

  return decodeURIComponent(urlWithoutQuery);
}

export function isPrivateStorageUrl(fileUrl: string): boolean {
  if (!fileUrl) return false;
  if (isBlobUrl(fileUrl)) return true;
  const cfg = getS3Config();
  return (
    fileUrl.includes(cfg.bucket) ||
    (!!cfg.endpoint && fileUrl.startsWith(cfg.endpoint)) ||
    /\.s3[.-]/.test(fileUrl) ||
    fileUrl.includes("/api/files/")
  );
}

export async function objectExists(fileUrl: string): Promise<boolean> {
  if (isBlobUrl(fileUrl)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("BLOB_READ_WRITE_TOKEN is required in production");
      }
      return true;
    }
    return blobObjectExists(fileUrl);
  }

  const mode = getStorageMode();
  if (mode === "s3") {
    const cfg = getS3Config();
    if (!cfg.accessKeyId) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("S3 credentials required in production");
      }
      return true;
    }
    try {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      await s3Client().send(
        new HeadObjectCommand({ Bucket: cfg.bucket, Key: extractKey(fileUrl) })
      );
      return true;
    } catch {
      return false;
    }
  }

  // local
  try {
    await access(path.join(localBaseDir(), extractKey(fileUrl)));
    return true;
  } catch {
    return false;
  }
}

/** EOI-style: never store this in DB — issue fresh on each view. */
export async function getPresignedDownloadUrl(fileUrl: string): Promise<string> {
  if (isBlobUrl(fileUrl)) {
    return blobGetDownloadUrl(fileUrl);
  }

  if (getStorageMode() === "s3" && isPrivateStorageUrl(fileUrl) && !fileUrl.includes("/api/files/")) {
    const cfg = getS3Config();
    if (cfg.accessKeyId) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const command = new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: extractKey(fileUrl),
      });
      return getSignedUrl(s3Client(), command, { expiresIn: DOWNLOAD_TTL_SEC });
    }
  }

  // Local / public absolute URL — return as-is (download route still auth-gates first)
  return fileUrl;
}

export async function deleteStoredObject(fileUrl: string): Promise<void> {
  if (isBlobUrl(fileUrl)) {
    await blobDelete(fileUrl);
    return;
  }
  if (getStorageMode() === "s3" && !fileUrl.includes("/api/files/")) {
    const cfg = getS3Config();
    if (!cfg.accessKeyId) return;
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client().send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: extractKey(fileUrl) })
    );
    return;
  }
  // local: best-effort unlink omitted (keep for audit); no-op
}

/** Write bytes for local PUT uploads (EOI has no local; Booking keeps for local dev). */
export async function putLocalObject(
  key: string,
  buffer: Buffer,
  _contentType: string
): Promise<UploadResult> {
  if (key.includes("..")) throw new Error("Invalid key");
  const fullPath = path.join(localBaseDir(), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { key, url: `${localPublicBase()}/${key}` };
}

/** Server-side upload (admin logos etc.) — still works across modes. */
export async function uploadFile(
  folder: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  options?: { access?: "public" | "private" }
): Promise<UploadResult> {
  const key = buildObjectKey(folder, fileName);
  const mode = getStorageMode();
  // Private Blob stores reject access:"public". Logos stay private and are
  // shown via resolveMediaDisplayUrl / signed URLs (same as KYC docs).
  const access = options?.access ?? "private";

  if (mode === "s3") {
    const cfg = getS3Config();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ...(access === "public" ? { ACL: "public-read" as const } : {}),
      })
    );
    return { key, url: permanentS3FileUrl(key) };
  }

  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    // Always private when store is private; ignore public requests for blob.
    const blob = await put(key, buffer, {
      access: "private",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
    });
    return { key, url: blob.url };
  }

  return putLocalObject(key, buffer, contentType);
}

/**
 * Resolve a stored media URL into something safe for <img src> / print HTML.
 * Private Blob/S3 objects get a short-lived signed URL; public/local pass through.
 */
export async function resolveMediaDisplayUrl(
  fileUrl: string | null | undefined,
  opts?: { baseOrigin?: string }
): Promise<string> {
  const raw = String(fileUrl ?? "").trim();
  if (!raw) return "";

  let url = raw;
  if (url.startsWith("/") && opts?.baseOrigin) {
    url = new URL(url, opts.baseOrigin.replace(/\/+$/, "")).toString();
  }

  if (isBlobUrl(url) || (getStorageMode() === "s3" && isPrivateStorageUrl(url))) {
    try {
      return await getPresignedDownloadUrl(url);
    } catch {
      return url;
    }
  }

  return url;
}

/** Sign/normalize logo fields on a branding object for print or customer HTML. */
export async function resolveBrandingLogosForDisplay(
  branding: Record<string, unknown>,
  baseOrigin?: string
): Promise<Record<string, unknown>> {
  const content =
    branding.content && typeof branding.content === "object"
      ? { ...(branding.content as Record<string, unknown>) }
      : {};

  const resolve = (raw: unknown) =>
    resolveMediaDisplayUrl(typeof raw === "string" ? raw : "", { baseOrigin });

  const [logoUrl, projectLogoUrl, heroImageUrl, secondaryLogoUrl] = await Promise.all([
    resolve(branding.logoUrl),
    resolve(content.projectLogoUrl),
    resolve(content.heroImageUrl),
    resolve(content.secondaryLogoUrl),
  ]);

  const next: Record<string, unknown> = { ...branding };
  if (logoUrl) next.logoUrl = logoUrl;
  if (projectLogoUrl) content.projectLogoUrl = projectLogoUrl;
  if (heroImageUrl) content.heroImageUrl = heroImageUrl;
  if (secondaryLogoUrl) content.secondaryLogoUrl = secondaryLogoUrl;
  next.content = content;
  return next;
}

export type { StorageMode };
