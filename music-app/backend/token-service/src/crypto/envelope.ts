import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for user tokens (ARCHITECTURE §7 / TOKEN_SERVICE §6).
 * A random per-record data key encrypts the token; the data key is wrapped by the
 * KMS master key. In production, swap `LocalKms` for a real cloud KMS — the `Kms`
 * interface is all the store depends on.
 */
export interface Kms {
  wrap(dataKey: Buffer): Promise<Buffer>;
  unwrap(wrapped: Buffer): Promise<Buffer>;
}

export interface EncryptedBlob {
  /** KMS-wrapped data key (base64). */
  dek: string;
  iv: string;
  ciphertext: string;
  authTag: string;
}

function aesGcmEncrypt(key: Buffer, plaintext: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext, authTag: cipher.getAuthTag() };
}

function aesGcmDecrypt(key: Buffer, iv: Buffer, ciphertext: Buffer, authTag: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Local KMS backed by a single AES-256-GCM master key. Dev/self-host only. */
export class LocalKms implements Kms {
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) throw new Error("master key must be 32 bytes");
  }
  async wrap(dataKey: Buffer): Promise<Buffer> {
    const { iv, ciphertext, authTag } = aesGcmEncrypt(this.masterKey, dataKey);
    return Buffer.concat([iv, authTag, ciphertext]); // 12 + 16 + n
  }
  async unwrap(wrapped: Buffer): Promise<Buffer> {
    const iv = wrapped.subarray(0, 12);
    const authTag = wrapped.subarray(12, 28);
    const ciphertext = wrapped.subarray(28);
    return aesGcmDecrypt(this.masterKey, iv, ciphertext, authTag);
  }
}

export async function encryptSecret(kms: Kms, plaintext: string): Promise<EncryptedBlob> {
  const dataKey = randomBytes(32);
  const { iv, ciphertext, authTag } = aesGcmEncrypt(dataKey, Buffer.from(plaintext, "utf8"));
  const wrapped = await kms.wrap(dataKey);
  return {
    dek: wrapped.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export async function decryptSecret(kms: Kms, blob: EncryptedBlob): Promise<string> {
  const dataKey = await kms.unwrap(Buffer.from(blob.dek, "base64"));
  const plaintext = aesGcmDecrypt(
    dataKey,
    Buffer.from(blob.iv, "base64"),
    Buffer.from(blob.ciphertext, "base64"),
    Buffer.from(blob.authTag, "base64"),
  );
  return plaintext.toString("utf8");
}
