/**
 * Encryption Utilities
 *
 * Used for encrypting sensitive data before storing in database,
 * such as OAuth tokens, API keys, etc.
 *
 * @module lib/encryption
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // If key is hex string (64 chars), convert to buffer
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }

  // If key is base64 (44 chars), convert to buffer
  if (key.length === 44) {
    return Buffer.from(key, "base64");
  }

  // Otherwise, hash the key to get 32 bytes
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a string value
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:tag:ciphertext (all base64)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  // Return as iv:tag:ciphertext
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param encryptedText - The encrypted string in format: iv:tag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivBase64, tagBase64, ciphertext] = parts;

  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt a JSON object
 * @param data - Object to encrypt
 * @returns Encrypted string
 */
export function encryptJSON<T>(data: T): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt to a JSON object
 * @param encryptedText - Encrypted string
 * @returns Decrypted object
 */
export function decryptJSON<T>(encryptedText: string): T {
  const decrypted = decrypt(encryptedText);
  return JSON.parse(decrypted) as T;
}

/**
 * Hash a password using bcrypt-like approach with crypto
 * For actual password hashing, use bcryptjs (already installed)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return hash === verifyHash;
}

/**
 * Generate a secure random token
 * @param length - Length of token in bytes (default 32)
 * @returns Random token as hex string
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a secure API key
 * Format: vfp_xxxxxxxxxxxxxxxxxxxx
 */
export function generateAPIKey(): string {
  const token = crypto.randomBytes(24).toString("base64url");
  return `vfp_${token}`;
}
