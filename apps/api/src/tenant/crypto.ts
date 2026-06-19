import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric crypto compatible with superadmin/lib/crypto.php (pp_encrypt/pp_decrypt).
 *
 * Format: base64(IV[16] || ciphertext)
 * Cipher: AES-256-CBC
 * Key:    SHA-256(PLATFORM_KEY) — 32 raw bytes
 *
 * Keep this 1:1 with the PHP version so values written by either side
 * decrypt cleanly on the other.
 */

function deriveKey(platformKey: string): Buffer {
  return createHash("sha256").update(platformKey, "utf8").digest();
}

export function ppEncrypt(plain: string, platformKey: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", deriveKey(platformKey), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct]).toString("base64");
}

export function ppDecrypt(cipherText: string | null | undefined, platformKey: string): string | null {
  if (!cipherText) return null;
  let raw: Buffer;
  try {
    raw = Buffer.from(cipherText, "base64");
  } catch {
    return null;
  }
  if (raw.length <= 16) return null;
  const iv = raw.subarray(0, 16);
  const ct = raw.subarray(16);
  try {
    const decipher = createDecipheriv("aes-256-cbc", deriveKey(platformKey), iv);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
