import { Injectable, BadRequestException, OnModuleInit } from "@nestjs/common";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

const ALLOWED = new Map<string, { exts: string[]; maxBytes: number }>([
  ["voucher", { exts: ["pdf", "jpg", "jpeg", "png", "webp"], maxBytes: 10 * 1024 * 1024 }],
  ["leave",   { exts: ["pdf", "jpg", "jpeg", "png", "webp"], maxBytes: 5 * 1024 * 1024 }],
  ["punch",   { exts: ["jpg", "jpeg", "png", "webp"],         maxBytes: 2 * 1024 * 1024 }],
  ["brand",   { exts: ["jpg", "jpeg", "png", "webp", "svg"],  maxBytes: 5 * 1024 * 1024 }],
]);

/**
 * File storage on disk under apps/api/uploads/<bucket>/<YYYY>/<MM>/.
 * Filename: <random-12>.<ext>. Bucket validates extension + size.
 *
 * In production swap this for S3/MinIO without changing the service signature.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  /** Filesystem root for all uploads. */
  readonly root = path.resolve(process.cwd(), "uploads");

  async onModuleInit() {
    for (const bucket of ALLOWED.keys()) {
      await fs.mkdir(path.join(this.root, bucket), { recursive: true });
    }
  }

  /** Save a buffer for a given bucket. Returns the web-relative path. */
  async save(bucket: string, originalName: string, buffer: Buffer): Promise<{
    filePath: string; mimeType: string | null; sizeBytes: number;
  }> {
    const rule = ALLOWED.get(bucket);
    if (!rule) throw new BadRequestException(`Unknown upload bucket: ${bucket}`);
    const ext = (originalName.split(".").pop() ?? "").toLowerCase();
    if (!rule.exts.includes(ext)) {
      throw new BadRequestException(`Disallowed file type for ${bucket}: .${ext}`);
    }
    if (buffer.length > rule.maxBytes) {
      throw new BadRequestException(
        `File too large for ${bucket} (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB)`,
      );
    }

    const now = new Date();
    const sub = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const dir = path.join(this.root, bucket, sub);
    await fs.mkdir(dir, { recursive: true });

    const name = `${randomBytes(8).toString("hex")}.${ext}`;
    const abs = path.join(dir, name);
    await fs.writeFile(abs, buffer);

    return {
      filePath: `/uploads/${bucket}/${sub}/${name}`,
      mimeType: this.guessMime(ext),
      sizeBytes: buffer.length,
    };
  }

  /** Decode a base64 payload (with or without data: prefix) and save it. */
  async saveBase64(bucket: string, originalName: string, base64: string) {
    const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(cleaned, "base64");
    return this.save(bucket, originalName, buf);
  }

  /** Resolve the absolute disk path for a web-relative upload path. */
  resolveWebPath(webPath: string): string {
    if (!webPath.startsWith("/uploads/")) {
      throw new BadRequestException("Refusing to serve file outside uploads/");
    }
    return path.join(this.root, webPath.replace(/^\/uploads\//, ""));
  }

  private guessMime(ext: string): string {
    switch (ext) {
      case "jpg": case "jpeg": return "image/jpeg";
      case "png": return "image/png";
      case "webp": return "image/webp";
      case "svg": return "image/svg+xml";
      case "pdf": return "application/pdf";
      default: return "application/octet-stream";
    }
  }
}
