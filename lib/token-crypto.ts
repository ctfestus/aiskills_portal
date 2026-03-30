import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)');
  return buf;
}

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * Returns a colon-separated string: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv  = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a token produced by encryptToken.
 * Throws if the ciphertext is tampered with (GCM auth tag mismatch).
 */
export function decryptToken(stored: string): string {
  const key    = getKey();
  const parts  = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivB64, tagB64, ctB64] = parts;
  const iv      = Buffer.from(ivB64,  'base64');
  const tag     = Buffer.from(tagB64, 'base64');
  const ct      = Buffer.from(ctB64,  'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString('utf8') + decipher.final('utf8');
}
