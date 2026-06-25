/**
 * SSO 資格情報のメモリ常駐ブローカー（background 専有・唯一の信頼境界）。
 *
 * 仕様により実資格情報は **平文で永続化しない**。コンソールから暗号化された
 * 資格情報を取得し、background のメモリ変数にのみ保持する。content からの
 * 問い合わせ（kiba:get-credential）に応じて、URL に一致する 1 件だけを返す。
 *
 * MV3 の service worker は数十秒で停止しメモリが揮発するため、「短命キャッシュ +
 * 遅延フェッチ」方式を採る。キャッシュが消えても次回問い合わせ時に再フェッチされ
 * 機能は継続する。chrome.storage.session も含め、資格情報は一切ディスクに書かない。
 */

import { decryptEnvelope, type EncryptedEnvelope } from '../lib/crypto';
import { CONSOLE_CONFIG, resolveKey } from '../lib/consoleClient';
import { isSsoUsable } from './authHandler';
import { matchCredential } from '../lib/ssoFiller';
import type { KibaSettings, SsoCredential } from '../types';

/** メモリ常駐の資格情報キャッシュ。worker 停止で意図的に揮発する。 */
let credentialCache: SsoCredential[] | null = null;
/** キャッシュの取得時刻（epoch ms）。 */
let cacheFetchedAt = 0;
/** キャッシュ有効期間（5 分）。 */
const CRED_CACHE_TTL_MS = 5 * 60_000;

/** unknown を SsoCredential 配列として検証する型ガード。 */
function isCredentialArray(value: unknown): value is SsoCredential[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c): c is SsoCredential =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as SsoCredential).urlMatch === 'string' &&
        typeof (c as SsoCredential).username === 'string' &&
        typeof (c as SsoCredential).password === 'string' &&
        typeof (c as SsoCredential).autoSubmit === 'boolean',
    )
  );
}

/** コンソールから暗号化資格情報を取得・復号してメモリへ載せる。失敗時は null。 */
async function fetchCredentials(): Promise<SsoCredential[] | null> {
  const { credentialUrl, keyRef } = CONSOLE_CONFIG;
  if (credentialUrl === null || keyRef === null) return null;

  try {
    const res = await fetch(credentialUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const envelope = (await res.json()) as EncryptedEnvelope;

    const key = await resolveKey(keyRef);
    const plaintext = await decryptEnvelope(envelope, key);
    const parsed: unknown = JSON.parse(plaintext);
    if (!isCredentialArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** キャッシュ未ヒット／TTL 切れなら再フェッチし、現在の資格情報配列を返す。 */
async function ensureCredentials(now: number): Promise<SsoCredential[] | null> {
  if (credentialCache && now - cacheFetchedAt < CRED_CACHE_TTL_MS) {
    return credentialCache;
  }
  const fresh = await fetchCredentials();
  if (fresh) {
    credentialCache = fresh;
    cacheFetchedAt = now;
  }
  return fresh;
}

/**
 * 指定 URL に一致する資格情報を返す。オフライン／TTL 切れ／未設定時は null
 * （= autofill しない＝フェイルセーフ）。password はこの戻り値の中だけに存在する。
 */
export async function getCredentialFor(
  url: string,
  settings: KibaSettings,
): Promise<SsoCredential | null> {
  // SSO が無効、またはオフライン／認証 TTL 切れなら一切返さない。
  if (!settings.ssoEnabled) return null;
  if (!isSsoUsable(settings, { online: navigator.onLine })) return null;

  const creds = await ensureCredentials(Date.now());
  if (!creds) return null;
  return matchCredential(url, creds);
}

/** 現在メモリに保持している資格情報の件数（popup の状態表示用。password は含めない）。 */
export function getCredentialCount(): number {
  return credentialCache?.length ?? 0;
}

/** ブローカーの初期化フック（将来のキャッシュ事前ウォーム等の置き場所）。 */
export function initCredentialBroker(): void {
  // メッセージング配線は background/index.ts の onMessage 集約側で行う。
}
