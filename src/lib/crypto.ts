/**
 * AES-GCM decryption utilities using BYOK (customer-managed keys).
 *
 * Pure functions for decrypting the encrypted policy / credential payloads
 * distributed by the console using a customer-managed symmetric key. They depend
 * on no DOM/Chrome API, so they are unit-testable, and `crypto.subtle` is
 * available via `globalThis.crypto` in Node / Service Worker / browser alike.
 *
 * Keys are never carried around as strings; they are always converted to a
 * CryptoKey before use. This policy avoids keeping plaintext keys in memory for
 * long.
 */

/** Reference to a BYOK key. The key itself is not placed in plaintext storage; only the reference is held. */
export type KeyRef =
  { source: 'raw-base64'; value: string } | { source: 'storage'; storageKey: string };

/** Envelope structure for AES-GCM ciphertext (the expected shape of the JSON the console returns). */
export interface EncryptedEnvelope {
  /** Base64-encoded 12-byte initialization vector (IV). */
  iv: string;
  /** Base64-encoded ciphertext (includes the GCM authentication tag). */
  ciphertext: string;
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

/** Imports raw key bytes as a CryptoKey for AES-GCM. */
export async function importAesGcmKey(
  rawKey: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<CryptoKey> {
  return subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
}

/**
 * Decrypts an AES-GCM envelope and returns a UTF-8 string. On decryption failure
 * (wrong key, tampering, invalid IV, etc.) `crypto.subtle` throws, so the caller
 * can use that as a discard-style fallback (do not apply invalid policy).
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
