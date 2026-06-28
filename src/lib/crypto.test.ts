import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  decryptEnvelope,
  decryptEnvelopeWithKey,
  encryptEnvelope,
  importAesGcmKey,
  type EncryptedEnvelope,
} from './crypto';

/** Helper that generates ArrayBuffer-backed random bytes (for WebCrypto type consistency). */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

/** Test helper that AES-GCM-encrypts plaintext and returns an envelope. */
async function encrypt(
  plaintext: string,
  rawKey: Uint8Array<ArrayBuffer>,
): Promise<EncryptedEnvelope> {
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

describe('base64ToBytes', () => {
  it('Base64 文字列をバイト列へ復元する', () => {
    expect(Array.from(base64ToBytes(btoa('ABC')))).toEqual([65, 66, 67]);
  });

  it('空文字列を空配列へ変換する', () => {
    expect(base64ToBytes('').length).toBe(0);
  });
});

describe('decryptEnvelope', () => {
  it('暗号化→復号のラウンドトリップで元の平文に戻る', async () => {
    const rawKey = randomBytes(32);
    const plaintext = '{"mode":"DRY_RUN"}';
    const envelope = await encrypt(plaintext, rawKey);

    const key = await importAesGcmKey(rawKey);
    await expect(decryptEnvelope(envelope, key)).resolves.toBe(plaintext);
  });

  it('誤った鍵では復号に失敗して例外を投げる', async () => {
    const rawKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const envelope = await encrypt('secret', rawKey);

    const key = await importAesGcmKey(wrongKey);
    await expect(decryptEnvelope(envelope, key)).rejects.toThrow();
  });

  it('暗号文が改竄されていると例外を投げる', async () => {
    const rawKey = randomBytes(32);
    const envelope = await encrypt('secret', rawKey);
    // Tamper by flipping the last byte of the ciphertext.
    const tampered = base64ToBytes(envelope.ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    const broken: EncryptedEnvelope = {
      iv: envelope.iv,
      ciphertext: bytesToBase64(tampered),
    };

    const key = await importAesGcmKey(rawKey);
    await expect(decryptEnvelope(broken, key)).rejects.toThrow();
  });
});

describe('encryptEnvelope / decryptEnvelopeWithKey', () => {
  it('ラウンドトリップで元の平文に戻る', async () => {
    const rawMasterKey = randomBytes(32);
    const plaintext = '{"version":1,"base":{"mode":"BLOCK"}}';
    const payload = await encryptEnvelope(plaintext, rawMasterKey);
    await expect(decryptEnvelopeWithKey(payload, rawMasterKey)).resolves.toBe(plaintext);
  });

  it('誤ったK_masterでは復号に失敗して例外を投げる', async () => {
    const rawMasterKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const payload = await encryptEnvelope('secret', rawMasterKey);
    await expect(decryptEnvelopeWithKey(payload, wrongKey)).rejects.toThrow();
  });

  it('wrappedKeyを改竄すると例外を投げる', async () => {
    const rawMasterKey = randomBytes(32);
    const payload = await encryptEnvelope('secret', rawMasterKey);
    const tampered = base64ToBytes(payload.wrappedKey);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(
      decryptEnvelopeWithKey({ ...payload, wrappedKey: bytesToBase64(tampered) }, rawMasterKey),
    ).rejects.toThrow();
  });

  it('ciphertextを改竄すると例外を投げる', async () => {
    const rawMasterKey = randomBytes(32);
    const payload = await encryptEnvelope('secret', rawMasterKey);
    const tampered = base64ToBytes(payload.ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(
      decryptEnvelopeWithKey({ ...payload, ciphertext: bytesToBase64(tampered) }, rawMasterKey),
    ).rejects.toThrow();
  });

  it('暗号化のたびに異なるciphertextを生成する（IV再利用なし）', async () => {
    const rawMasterKey = randomBytes(32);
    const plaintext = 'same plaintext';
    const p1 = await encryptEnvelope(plaintext, rawMasterKey);
    const p2 = await encryptEnvelope(plaintext, rawMasterKey);
    expect(p1.ciphertext).not.toBe(p2.ciphertext);
    expect(p1.iv).not.toBe(p2.iv);
    expect(p1.wrappedKey).not.toBe(p2.wrappedKey);
  });
});
