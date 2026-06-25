/**
 * コンソール（admin console）接続の唯一の差し込み口。
 *
 * ポリシー同期・SSO 資格情報取得・One-Time Bypass 承認の 3 機能はすべて、
 * バックエンドのコンソール API を起点に動作する。本番化に必要な「エンドポイント
 * URL と BYOK 鍵」をこの 1 ファイルに集約し、後日 `CONSOLE_CONFIG` を埋めるだけで
 * 全機能が稼働する状態にしている。
 *
 * コンソール API は後日公開予定のため、現状はすべて null。null の各機能は
 * 安全側（同期 no-op／autofill 無効／ローカル即時承認）にフォールバックする。
 */

import { base64ToBytes, importAesGcmKey, type KeyRef } from './crypto';

/** コンソール接続設定。各 URL/鍵が null のときは該当機能を安全側へフォールバック。 */
export interface ConsoleConfig {
  /** 暗号化ポリシーの pull 先 URL。null のとき同期は no-op（ローカル既定を維持）。 */
  policyUrl: string | null;
  /** SSO 資格情報取得 API の URL。null のとき SSO autofill は無効。 */
  credentialUrl: string | null;
  /** One-Time Bypass 承認 API の URL。null のときローカル即時承認（デモ挙動）。 */
  bypassApprovalUrl: string | null;
  /** BYOK 鍵の参照。null のとき暗号ペイロードを要する機能は無効。 */
  keyRef: KeyRef | null;
}

/**
 * 本番化の唯一の編集点。後日この定数の各 URL と keyRef を埋めるだけで、
 * ポリシー同期・SSO 資格情報・Bypass 承認のすべてがコンソール連携で稼働する。
 */
export const CONSOLE_CONFIG: ConsoleConfig = {
  policyUrl: null,
  credentialUrl: null,
  bypassApprovalUrl: null,
  keyRef: null,
};

/**
 * KeyRef を AES-GCM 用の CryptoKey へ解決する。
 *  - `raw-base64`: 設定に直接埋め込まれた Base64 鍵（暫定運用）。
 *  - `storage`   : chrome.storage.local の別キーに置かれた Base64 鍵。
 */
export async function resolveKey(ref: KeyRef): Promise<CryptoKey> {
  if (ref.source === 'raw-base64') {
    return importAesGcmKey(base64ToBytes(ref.value));
  }
  const result = await chrome.storage.local.get(ref.storageKey);
  const value = result[ref.storageKey];
  if (typeof value !== 'string') {
    throw new Error(`BYOK key not found at storage key: ${ref.storageKey}`);
  }
  return importAesGcmKey(base64ToBytes(value));
}
