import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'ts6-webui-enc-v1';

let encryptionKey: Buffer | null = null;

function getKey(): Buffer {
  if (encryptionKey) return encryptionKey;

  // config.encryptionKey is mandatory and validated at startup, so there is no
  // fallback to JWT_SECRET: deriving the at-rest key from the signing key made
  // one leak decrypt every stored ServerQuery key, SSH password and TOTP secret.
  //
  // SALT stays a fixed constant on purpose — changing it would make existing
  // ciphertext undecryptable. Its job was to stop cross-install precomputation,
  // which a mandatory high-entropy ENCRYPTION_KEY already rules out.
  encryptionKey = scryptSync(config.encryptionKey, SALT, 32);
  return encryptionKey;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: `enc:iv:tag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted by `encrypt()`.
 * If the string doesn't start with `enc:`, returns it as-is (plaintext migration).
 * Values encrypted before ENCRYPTION_KEY existed were keyed from JWT_SECRET;
 * those still decrypt via the legacy key and are re-encrypted on next save.
 */
export function decrypt(encrypted: string): string {
  // Support plaintext values (migration: not yet encrypted)
  if (!encrypted.startsWith('enc:')) return encrypted;

  const parts = encrypted.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted format');

  const [, ivHex, tagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const tryKey = (key: Buffer): string => {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  try {
    return tryKey(getKey());
  } catch (err) {
    if (process.env.ENCRYPTION_KEY) {
      // Legacy fallback: value was encrypted with the JWT_SECRET-derived key
      return tryKey(scryptSync(config.jwtSecret, SALT, 32));
    }
    throw err;
  }
}
