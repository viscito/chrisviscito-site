import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { LocalKms, encryptSecret, decryptSecret } from "../src/crypto/envelope.js";

describe("envelope encryption", () => {
  const kms = new LocalKms(randomBytes(32));

  it("round-trips a secret", async () => {
    const blob = await encryptSecret(kms, "music-user-token-abc123");
    expect(blob.ciphertext).not.toContain("music-user-token");
    const plain = await decryptSecret(kms, blob);
    expect(plain).toBe("music-user-token-abc123");
  });

  it("produces distinct ciphertexts for the same input (random data key + IV)", async () => {
    const a = await encryptSecret(kms, "same");
    const b = await encryptSecret(kms, "same");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.dek).not.toBe(b.dek);
  });

  it("fails to decrypt if the auth tag is tampered", async () => {
    const blob = await encryptSecret(kms, "secret");
    const tampered = { ...blob, authTag: Buffer.from(randomBytes(16)).toString("base64") };
    await expect(decryptSecret(kms, tampered)).rejects.toThrow();
  });

  it("rejects a wrong-size master key", () => {
    expect(() => new LocalKms(randomBytes(16))).toThrow();
  });
});
