import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export interface UploadResult {
  key: string;
  url: string;
}

export interface StorageProvider {
  upload(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult>;
  getPublicUrl(key: string): string;
}

class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string, private publicBaseUrl: string) {}

  async upload(
    folder: string,
    fileName: string,
    buffer: Buffer,
    _contentType: string
  ): Promise<UploadResult> {
    const ext = path.extname(fileName) || "";
    const key = `${folder}/${randomUUID()}${ext}`;
    const fullPath = path.join(this.baseDir, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return { key, url: `${this.publicBaseUrl}/${key}` };
  }

  getPublicUrl(key: string) {
    return `${this.publicBaseUrl}/${key}`;
  }
}

class S3StorageProvider implements StorageProvider {
  constructor(
    private bucket: string,
    private region: string,
    private publicBaseUrl?: string
  ) {}

  async upload(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<UploadResult> {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const ext = path.extname(fileName) || "";
    const key = `${folder}/${randomUUID()}${ext}`;
    const client = new S3Client({ region: this.region });
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    const url = this.publicBaseUrl
      ? `${this.publicBaseUrl}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { key, url };
  }

  getPublicUrl(key: string) {
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${key}`;
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;

  const mode = process.env.STORAGE_PROVIDER ?? "local";
  if (mode === "s3") {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION ?? "ap-south-1";
    if (!bucket) throw new Error("S3_BUCKET required when STORAGE_PROVIDER=s3");
    provider = new S3StorageProvider(bucket, region, process.env.S3_PUBLIC_URL);
  } else {
    const baseDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), "storage");
    const publicBase = process.env.STORAGE_PUBLIC_URL ?? "/api/files";
    provider = new LocalStorageProvider(baseDir, publicBase);
  }
  return provider;
}

export async function uploadFile(
  folder: string,
  fileName: string,
  buffer: Buffer,
  contentType: string
) {
  return getStorageProvider().upload(folder, fileName, buffer, contentType);
}
