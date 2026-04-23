import { describe, it, expect } from "vitest"
import { encryptFile, decryptFile, generateFileKey } from "../crypto"

describe("encryption", () => {
  it("encrypts and decrypts a buffer", () => {
    const plaintext = Buffer.from("hello legal world")
    const key = generateFileKey()
    const encrypted = encryptFile(plaintext, key)
    const decrypted = decryptFile(encrypted, key)
    expect(decrypted.toString()).toBe("hello legal world")
  })
})
