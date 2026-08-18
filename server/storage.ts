import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

import { ENV } from "./_core/env";

function getS3Client() {
  if (!ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey || !ENV.s3Endpoint) {
    throw new Error("Storage config missing: configure the Railway S3 bucket variables.");
  }

  return new S3Client({
    endpoint: ENV.s3Endpoint,
    region: ENV.s3Region,
    forcePathStyle: false,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const key = appendHashSuffix(normalizeKey(relKey));
  await client.send(new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, Body: data, ContentType: contentType }));
  return { key, url: `/railway-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/railway-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const client = getS3Client();
  const key = normalizeKey(relKey);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: 3600 });
}
