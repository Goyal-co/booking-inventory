import { ListBucketsCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { head } from "@vercel/blob";
import { getS3Config, getStorageMode, type StorageMode } from "./provider";

export async function blobHealthCheck(): Promise<boolean> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return false;
  try {
    // Lightweight auth check: head a non-existent path; 404/BlobNotFound still means credentials work.
    await head("health-check-probe", { token });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Missing object is OK — token is valid. Auth failures are not.
    if (/not found|404|BlobNotFound|does not exist/i.test(msg)) return true;
    if (/unauthorized|forbidden|401|403|invalid.*token/i.test(msg)) return false;
    // Network / unknown: treat as degraded
    return false;
  }
}

export async function s3HealthCheck(): Promise<boolean> {
  const cfg = getS3Config();
  if (!cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return true;
  } catch {
    try {
      // Fallback: ListBuckets proves credentials even if HeadBucket is denied
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { S3Client } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
      const client = new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
        forcePathStyle: cfg.forcePathStyle,
      });
      await client.send(new ListBucketsCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}

export async function storageHealthCheck(): Promise<{ ok: boolean; mode: StorageMode }> {
  const mode = getStorageMode();
  if (mode === "blob") return { ok: await blobHealthCheck(), mode };
  if (mode === "s3") return { ok: await s3HealthCheck(), mode };
  // local disk always "ok" for liveness of config in single-instance deploys
  return { ok: true, mode };
}
