/**
 * AES-GCM encryption/decryption utilities using BYOK (customer-managed keys).
 *
 * Provides both the single-layer envelope (legacy OSS path) and the two-layer
 * envelope (enterprise path) using only `globalThis.crypto.subtle` — no external
 * crypto libraries, no Node-specific modules. All crypto operations stay local to
 * the extension; the server stores only opaque blobs.
 *
 * Keys are never carried around as strings; they are always converted to a
 * CryptoKey before use. This policy avoids keeping plaintext keys in memory for
 * long.
 */

/** Reference to a BYOK key. The key itself is not placed in plaintext storage; only the reference is held. */
export type KeyRef =
  { source: 'raw-base64'; value: string } | { source: 'storage'; storageKey: string };

/** Single-layer envelope (OSS path): AES-GCM ciphertext encrypted directly with K_master. */
export interface EncryptedEnvelope {
  /** Base64-encoded 12-byte initialization vector (IV). */
  iv: string;
  /** Base64-encoded ciphertext (includes the GCM authentication tag). */
  ciphertext: string;
}

/**
 * Two-layer envelope payload (enterprise path).
 *
 * K_data (a per-payload ephemeral key) encrypts the plaintext; K_master wraps
 * K_data. The server stores this structure without ever holding a plaintext key.
 */
export interface EnvelopePayload {
  /** Base64(AES-GCM-Encrypt(K_data, plaintext)) */
  ciphertext: string;
  /** Base64(AES-GCM-Encrypt(K_master, raw K_data bytes)) */
  wrappedKey: string;
  /** Base64(12-byte IV for the data encryption) */
  iv: string;
  /** Base64(12-byte IV for the key wrap) */
  wrapIv: string;
}

/**
 * Converts a Base64 string to a Uint8Array.
 *
 * By allocating the buffer as an `ArrayBuffer`, the type is fixed so it can be
 * passed directly to WebCrypto's BufferSource (which does not allow SharedArrayBuffer).
 */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Converts a Uint8Array to a Base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Imports raw key bytes as a CryptoKey for AES-GCM decryption. */
export async function importAesGcmKey(
  rawKey: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<CryptoKey> {
  return subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
}

/**
 * Decrypts a single-layer AES-GCM envelope and returns a UTF-8 string. On
 * decryption failure (wrong key, tampering, invalid IV, etc.) `crypto.subtle`
 * throws, so the caller can use that as a discard-style fallback.
 *
 * `subtle` is replaceable via an argument to make testing easy.
 */
export async function decryptEnvelope(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<string> {
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypts a plaintext string using the two-layer envelope scheme.
 *
 * A fresh K_data (32 random bytes) is generated for each call, used to encrypt
 * the plaintext, then wrapped by K_master. Both operations use independent random
 * 12-byte IVs. The returned `EnvelopePayload` is safe to store on the server —
 * it reveals nothing without K_master.
 */
export async function encryptEnvelope(
  plaintext: string,
  rawMasterKey: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<EnvelopePayload> {
  const rawDataKey = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
  const dataIv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const wrapIv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));

  const dataKey = await subtle.importKey('raw', rawDataKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const masterKey = await subtle.importKey('raw', rawMasterKey, { name: 'AES-GCM' }, false, ['encrypt']);

  const ciphertextBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: dataIv },
    dataKey,
    new TextEncoder().encode(plaintext),
  );

  const wrappedKeyBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: wrapIv },
    masterKey,
    rawDataKey,
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuf)),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKeyBuf)),
    iv: bytesToBase64(dataIv),
    wrapIv: bytesToBase64(wrapIv),
  };
}

/**
 * Decrypts a two-layer `EnvelopePayload` using K_master.
 *
 * 1. Unwrap K_data from `wrappedKey` using K_master.
 * 2. Decrypt `ciphertext` using K_data.
 *
 * Throws on any decryption failure (wrong key, tampering, invalid IVs), so the
 * caller can treat the exception as a "do not apply" signal.
 */
export async function decryptEnvelopeWithKey(
  payload: EnvelopePayload,
  rawMasterKey: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<string> {
  const masterKey = await subtle.importKey('raw', rawMasterKey, { name: 'AES-GCM' }, false, ['decrypt']);

  const rawDataKeyBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.wrapIv) },
    masterKey,
    base64ToBytes(payload.wrappedKey),
  );

  const dataKey = await subtle.importKey(
    'raw',
    new Uint8Array(rawDataKeyBuf) as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const plaintextBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    dataKey,
    base64ToBytes(payload.ciphertext),
  );

  return new TextDecoder().decode(plaintextBuf);
}
