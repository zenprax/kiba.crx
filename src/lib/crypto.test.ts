import { describe, expect, it } from 'vitest';
import { base64ToBytes, decryptEnvelope, importAesGcmKey, type EncryptedEnvelope } from './crypto';

/** ArrayBuffer 固定のランダムバイト列を生成するヘルパー（WebCrypto 型整合のため）。 */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

/** バイト列を Base64 へ変換するテスト用ヘルパー（本体は復号専用のため）。 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** 平文を AES-GCM で暗号化し封筒を返すテスト用ヘルパー。 */
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
    // 暗号文の末尾バイトを反転させて改竄する。
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
