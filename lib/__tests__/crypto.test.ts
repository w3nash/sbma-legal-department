import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptFile, encryptFile, generateFileKey } from "../crypto";

describe("encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("encrypts and decrypts a buffer", () => {
    const plaintext = Buffer.from("hello legal world");
    const key = generateFileKey();
    const encrypted = encryptFile(plaintext, key);
    const decrypted = decryptFile(encrypted, key);
    expect(decrypted.toString()).toBe("hello legal world");
  });

  it("encrypts and decrypts file keys with a 32-byte master key", async () => {
    vi.stubEnv("MASTER_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));

    const { decryptKey, encryptKey } = await import("../crypto");
    const fileKey = generateFileKey();

    expect(decryptKey(encryptKey(fileKey))).toBe(fileKey);
  });

  it("throws a clear error when the master key is not 32 bytes", async () => {
    vi.stubEnv("MASTER_ENCRYPTION_KEY", Buffer.alloc(48, 1).toString("base64"));

    const { encryptKey } = await import("../crypto");

    expect(() => encryptKey(generateFileKey())).toThrow(
      "MASTER_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
    );
  });
});
