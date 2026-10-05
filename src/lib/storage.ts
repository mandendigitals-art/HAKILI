/**
 * Adaptateurs de stockage de fichiers HAKILI :
 * - LocalStorage : stockage local avec vérification stricte anti-traversal via path.relative
 * - SupabaseStorage : stockage Supabase Storage via REST API sécurisée
 * - AwsS3Storage : stockage S3 compatible AWS S3 / MinIO / Cloudflare R2 avec le SDK officiel @aws-sdk/client-s3
 */

import { mkdir, writeFile, rm, readFile } from "fs/promises";
import path from "path";
import { AppError } from "@/lib/security";

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix?(prefix: string): Promise<void>;
}

export class LocalStorage implements StorageAdapter {
  private root: string;

  constructor(customPath?: string) {
    this.root = path.resolve(customPath ?? process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), "storage"));
  }

  private resolveKey(key: string): string {
    if (key.includes("..") || path.isAbsolute(key) || key.startsWith("/") || key.startsWith("\\")) {
      throw new AppError("Chemin de stockage non autorisé.");
    }
    const fullPath = path.resolve(this.root, key);
    const rel = path.relative(this.root, fullPath);

    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new AppError("Chemin de stockage non autorisé.");
    }
    return fullPath;
  }

  async put(key: string, data: Buffer, _contentType?: string): Promise<string> {
    const fullPath = this.resolveKey(key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolveKey(key);
    return readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    try {
      const fullPath = this.resolveKey(key);
      await rm(fullPath, { force: true });
    } catch {
      // Ignorer si le fichier n'existe pas
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    try {
      const fullPath = this.resolveKey(prefix);
      await rm(fullPath, { recursive: true, force: true });
    } catch {
      // Ignorer si le dossier n'existe pas
    }
  }
}

export class SupabaseStorage implements StorageAdapter {
  private endpoint: string;
  private bucket: string;
  private token: string;

  constructor() {
    this.endpoint = (process.env.SUPABASE_URL || process.env.S3_ENDPOINT || "").replace(/\/$/, "");
    this.bucket = process.env.SUPABASE_BUCKET || process.env.S3_BUCKET || "hakili";
    this.token = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.S3_BEARER_TOKEN || "";
  }

  private url(key: string): string {
    const base = this.endpoint.includes("/storage/v1") ? this.endpoint : `${this.endpoint}/storage/v1`;
    return `${base}/object/${this.bucket}/${key}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const res = await fetch(this.url(key), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new AppError(`Supabase Storage HTTP ${res.status}`);
    }
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const res = await fetch(this.url(key), {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) {
      throw new AppError(`Supabase Storage HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await fetch(this.url(key), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

export class AwsS3Storage implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || "auto";
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true" || !!endpoint;

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
    this.bucket = process.env.S3_BUCKET || "hakili";
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const res: GetObjectCommandOutput = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    if (!res.Body) throw new AppError("Objet S3 introuvable.");
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

export function getStorage(): StorageAdapter {
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "s3") {
    return new AwsS3Storage();
  }
  if (driver === "supabase") {
    return new SupabaseStorage();
  }
  return new LocalStorage();
}
