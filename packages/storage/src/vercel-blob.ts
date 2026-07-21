import { head, del, issueSignedToken, presignUrl } from "@vercel/blob";
import { getStorageMode, isBlobUrl } from "./provider";

const DOWNLOAD_TTL_MS = 15 * 60 * 1000;

const token = () => process.env.BLOB_READ_WRITE_TOKEN;

function pathnameFromBlobUrl(fileUrl: string): string {
  const pathname = new URL(fileUrl).pathname;
  return pathname.startsWith("/") ? pathname.slice(1) : pathname;
}

export async function blobObjectExists(fileUrl: string): Promise<boolean> {
  if (!token()) return false;
  try {
    await head(fileUrl, { token: token() });
    return true;
  } catch {
    return false;
  }
}

export async function blobGetDownloadUrl(fileUrl: string): Promise<string> {
  const blobToken = token();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");

  const pathname = pathnameFromBlobUrl(fileUrl);
  const validUntil = Date.now() + DOWNLOAD_TTL_MS;

  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
    token: blobToken,
  });

  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    validUntil,
    access: "private",
  });

  return presignedUrl;
}

export async function blobDelete(fileUrl: string): Promise<void> {
  if (!token()) return;
  await del(fileUrl, { token: token() });
}

export function isBlobStorageUrl(fileUrl: string): boolean {
  return isBlobUrl(fileUrl);
}

export function getStorageModeForUpload() {
  return getStorageMode();
}
