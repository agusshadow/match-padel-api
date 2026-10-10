import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM envelope for secrets stored in the database (card #74: Mercado
// Pago tokens of the clubs). Format: `v1:` + base64url(iv(12) | tag(16) | ciphertext).
// A random IV is generated for every value. `aad` (additional authenticated data)
// binds a ciphertext to its owner (e.g. `<clubId>:access`), so a value copied to
// another row or column fails authentication instead of decrypting.
//
// The key never touches the database: it comes from MP_TOKEN_ENCRYPTION_KEY.
// The `v1:` prefix lets a future key or algorithm rotation coexist with old rows.

const VERSION_PREFIX = 'v1:'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretBoxError'
  }
}

/** 32 bytes encoded as base64 (standard or url-safe). Returns null when absent or not exactly 32 bytes. */
export function parseEncryptionKey(value: string | undefined | null): Buffer | null {
  const raw = value?.trim()
  if (!raw || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(raw)) return null
  const key = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  return key.length === KEY_BYTES ? key : null
}

export function encryptSecret(plaintext: string, key: Buffer, aad?: string): string {
  if (key.length !== KEY_BYTES) throw new SecretBoxError('Encryption key must be 32 bytes')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return VERSION_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64url')
}

export function decryptSecret(blob: string, key: Buffer, aad?: string): string {
  if (key.length !== KEY_BYTES) throw new SecretBoxError('Encryption key must be 32 bytes')
  if (!blob.startsWith(VERSION_PREFIX)) throw new SecretBoxError('Unsupported secret format')
  const raw = Buffer.from(blob.slice(VERSION_PREFIX.length), 'base64url')
  if (raw.length < IV_BYTES + TAG_BYTES + 1) throw new SecretBoxError('Secret is malformed')
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES)
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    // Never echo the cause: it could hint at the key or the content.
    throw new SecretBoxError('Secret could not be decrypted (wrong key or tampered value)')
  }
}
