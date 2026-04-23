import crypto from "crypto"
import { env } from "@/env"

function getMasterKey(): Buffer {
  return Buffer.from(env.MASTER_ENCRYPTION_KEY, "base64")
}

export function generateFileKey(): string {
  return crypto.randomBytes(32).toString("base64")
}

export function encryptFile(plaintext: Buffer, keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64")
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
}

export function decryptFile(encrypted: Buffer, keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64")
  const iv = encrypted.subarray(0, 16)
  const authTag = encrypted.subarray(16, 32)
  const ciphertext = encrypted.subarray(32)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function encryptKey(fileKey: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(fileKey, "base64")),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64")
}

export function decryptKey(encryptedKeyB64: string): string {
  const encrypted = Buffer.from(encryptedKeyB64, "base64")
  const iv = encrypted.subarray(0, 16)
  const authTag = encrypted.subarray(16, 32)
  const ciphertext = encrypted.subarray(32)
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), iv)
  decipher.setAuthTag(authTag)
  const key = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return key.toString("base64")
}
