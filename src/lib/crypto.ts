/**
 * BYOK（顧客管理鍵）による AES-GCM 復号ユーティリティ。
 *
 * コンソールが配信する暗号化ポリシー／資格情報ペイロードを、顧客管理の対称鍵で
 * 復号するための純粋関数群。DOM/Chrome API に依存しないため単体テスト可能で、
 * `crypto.subtle` は Node / Service Worker / ブラウザいずれの `globalThis.crypto`
 * でも利用できる。
 *
 * 鍵は文字列のまま持ち回らず、必ず CryptoKey に変換して扱う。平文鍵を長く
 * メモリに留めないための方針。
 */

/** BYOK 鍵の参照。鍵そのものは平文 storage に置かず、参照のみを保持する。 */
export type KeyRef =
  | { source: 'raw-base64'; value: string }
  | { source: 'storage'; storageKey: string };

/** AES-GCM 暗号文の封筒構造（コンソールが返す JSON の想定形）。 */
export interface EncryptedEnvelope {
  /** Base64 エンコードされた 12 バイトの初期化ベクトル（IV）。 */
  iv: string;
  /** Base64 エンコードされた暗号文（GCM 認証タグを含む）。 */
  ciphertext: string;
}

/**
 * Base64 文字列を Uint8Array へ変換する。
 *
 * バッファを `ArrayBuffer` で確保することで、WebCrypto の BufferSource
 * （SharedArrayBuffer を許容しない）に直接渡せる型に固定する。
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

/** raw 鍵バイト列を AES-GCM 用の CryptoKey にインポートする。 */
export async function importAesGcmKey(
  rawKey: Uint8Array<ArrayBuffer>,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<CryptoKey> {
  return subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
}

/**
 * AES-GCM 封筒を復号し UTF-8 文字列を返す。鍵違い・改竄・IV 不正などの復号失敗は
 * `crypto.subtle` が例外を投げるため、呼び出し側はそれを破棄系のフォールバックに
 * 使える（不正なポリシーは適用しない）。
 *
 * `subtle` を引数で差し替え可能にしてテストを容易にしている。
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
