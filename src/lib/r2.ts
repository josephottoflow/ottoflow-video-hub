/**
 * Cloudflare R2 storage client — S3-compatible.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID     — Cloudflare account ID (found in R2 dashboard)
 *   R2_ACCESS_KEY     — R2 API token access key
 *   R2_SECRET_KEY     — R2 API token secret key
 *   R2_BUCKET         — bucket name (default: "ottoflow-videos")
 *   R2_PUBLIC_URL     — public bucket base URL (e.g. https://pub-xxx.r2.dev or custom domain)
 *
 * Usage:
 *   import { uploadToR2, r2Url, isR2Available } from "@/lib/r2";
 *   const url = await uploadToR2("videos/my-slug.mp4", buffer, "video/mp4");
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID is not set");
  return new S3Client({
    region:   "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY!,
      secretAccessKey: process.env.R2_SECRET_KEY!,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET || "ottoflow-videos";

export function isR2Available(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY);
}

/** Returns the public CDN URL for a given R2 key. */
export function r2Url(key: string): string {
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL is not set");
  return `${base}/${key}`;
}

/** Upload a Buffer to R2. Returns the public URL. */
export async function uploadToR2(
  key:         string,
  body:        Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  return r2Url(key);
}

/** Upload a local file to R2 by path. Returns the public URL. */
export async function uploadFileToR2(
  key:         string,
  filePath:    string,
  contentType: string
): Promise<string> {
  const body = fs.readFileSync(filePath);
  return uploadToR2(key, body, contentType);
}

/** Delete an object from R2 by key. */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}

/** Infer MIME type from file extension. */
export function mimeFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".mov":  "video/quicktime",
    ".mp3":  "audio/mpeg",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
  };
  return map[ext] || "application/octet-stream";
}
