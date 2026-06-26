/**
 * Pull 型ポリシー同期。
 *
 * 仕様どおり kiba.crx は WebSocket を張らない。ポリシー更新はスケジュール
 * （chrome.alarms）・起動時・ネットワーク復帰時に静的 URL から *pull* する。
 * 取得ペイロードは顧客管理鍵（BYOK）で AES-GCM 暗号化された JSON で、
 * crypto.subtle で復号する。
 *
 * エンドポイントと鍵は src/lib/consoleClient.ts の CONSOLE_CONFIG に集約。
 * 未設定（null）のときは no-op となり、ローカル既定ポリシーが維持される。
 */

import { base64ToBytes, decryptEnvelope, type EncryptedEnvelope } from '../lib/crypto';
import { CONSOLE_CONFIG, resolveKey } from '../lib/consoleClient';
import { parsePolicyPayload, type PolicyPatch } from '../lib/policySchema';
import {
  compileActiveSettings,
  decodeJwtPayload,
  decryptPolicyBlob,
} from '../lib/policyFilter';
import { getSettings, setSettings } from '../lib/storage';
import type { KibaSettings, KibaSettingsPatch, PolicyClaims } from '../types';

/** chrome.alarms name used to schedule periodic policy pulls. */
const SYNC_ALARM = 'kiba:sync';

/** Sync interval in minutes. */
const SYNC_PERIOD_MINUTES = 30;

/**
 * 組織配信ポリシー（policy.bin）の取得元ベース URL。`${policyId}` 部分に
 * managed/local の policyId(UUID) を埋めてユーザー（テナント）別の暗号 blob を pull する。
 */
const POLICY_BASE_URL = 'https://policy.zenprax.com/v1/users';

/** AES-GCM の初期化ベクトル長（バイト）。blob 先頭をこの長さだけ IV として剥がす。 */
const IV_LEN = 12;

/**
 * 暫定モック復号鍵（32 バイト）。本番ではコンソール公開後に BYOK 鍵
 * （chrome.storage.local.customDecryptionKey）を使う。鍵未設定時のフォールバック。
 * 0..31 の固定バイト列で、デモ／開発用途のみ。
 */
const MOCK_KEY: Uint8Array<ArrayBuffer> = (() => {
  const buf = new ArrayBuffer(32);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 32; i++) bytes[i] = i;
  return bytes;
})();

/**
 * 検証済みポリシーパッチを現在の設定へ適用する。auth は部分パッチなので既存値と
 * 合成してから保存する（setSettings は浅いマージのため auth は丸ごと置換される）。
 */
async function applyPolicyPatch(patch: PolicyPatch | KibaSettingsPatch): Promise<void> {
  const { auth: authPatch, ...rest } = patch;
  const update: Partial<KibaSettings> = { ...rest };

  if (authPatch) {
    const current = await getSettings();
    update.auth = { ...current.auth, ...authPatch };
  }

  await setSettings(update);
}

/**
 * リモートポリシーを pull して適用する。エンドポイント／鍵が未設定のときは
 * 即座に return（OSS フォールバック：ローカル既定を維持）。fetch 失敗・復号失敗・
 * スキーマ不正はいずれもローカル現状維持で握りつぶす（不正ポリシーは適用しない）。
 */
export async function syncPolicy(): Promise<void> {
  const { policyUrl, keyRef } = CONSOLE_CONFIG;
  if (policyUrl === null || keyRef === null) return;

  try {
    const res = await fetch(policyUrl, { cache: 'no-store' });
    if (!res.ok) return;
    const envelope = (await res.json()) as EncryptedEnvelope;

    const key = await resolveKey(keyRef);
    const plaintext = await decryptEnvelope(envelope, key);
    const patch = parsePolicyPayload(JSON.parse(plaintext));
    if (!patch) return;

    await applyPolicyPatch(patch);
  } catch {
    // ネットワーク／復号／パース失敗時はローカル既定を維持する。
    return;
  }
}

/**
 * 同期に用いる policyId を解決する。GPO/MDM で配備された managed 値を最優先し、
 * 無ければ個人ユーザーが Popup で設定した local の customPolicyId をフォールバック。
 * どちらも無ければ null（＝既存 CONSOLE_CONFIG 経路へフォールバックさせる）。
 */
async function resolvePolicyId(): Promise<string | null> {
  // chrome.storage.managed は管理スキーマ未配備環境で例外/空になりうるため try/catch。
  try {
    const managed = await chrome.storage.managed.get(['policyId']);
    if (typeof managed.policyId === 'string' && managed.policyId.length > 0) {
      return managed.policyId;
    }
  } catch {
    // managed 非対応環境（個人 Chrome 等）。local フォールバックへ進む。
  }

  const local = await chrome.storage.local.get('customPolicyId');
  if (typeof local.customPolicyId === 'string' && local.customPolicyId.length > 0) {
    return local.customPolicyId;
  }
  return null;
}

/**
 * BYOK 復号鍵の生バイト列を解決する。個人が Popup で保存した Base64 鍵
 * （customDecryptionKey）を優先し、未設定ならコンソール公開までの暫定 MOCK_KEY。
 */
async function resolveRawKey(): Promise<Uint8Array<ArrayBuffer>> {
  const local = await chrome.storage.local.get('customDecryptionKey');
  if (typeof local.customDecryptionKey === 'string' && local.customDecryptionKey.length > 0) {
    return base64ToBytes(local.customDecryptionKey);
  }
  return MOCK_KEY;
}

/**
 * エンタープライズ向け：policyId をもとに暗号化マスターポリシー（policy.bin）を
 * pull し、現在のユーザーの JWT クレームで属性ベースにフィルタして適用する。
 *
 * policyId が無い場合は既存の CONSOLE_CONFIG 経路（{@link syncPolicy}）へフォール
 * バックする。fetch／復号／パース失敗はすべて握りつぶし、ローカル現状を維持する
 * （不正なポリシーは適用しない）。
 */
export async function syncManagedPolicy(): Promise<void> {
  const policyId = await resolvePolicyId();
  if (policyId === null) {
    // 組織ポリシー未指定。OSS／コンソール経路へフォールバック。
    await syncPolicy();
    return;
  }

  try {
    const url = `${POLICY_BASE_URL}/${encodeURIComponent(policyId)}/policy.bin`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;

    // blob レイアウト: [先頭 12 バイト = IV][残り = AES-GCM 暗号文＋認証タグ]。
    const blob = await res.arrayBuffer();
    if (blob.byteLength <= IV_LEN) return;
    const iv = new Uint8Array(blob.slice(0, IV_LEN));
    const ciphertext = blob.slice(IV_LEN);

    const rawKey = await resolveRawKey();
    const masterPolicy = await decryptPolicyBlob(ciphertext, rawKey, iv);

    // 現在のユーザーの JWT クレーム（ストレージの auth.idToken）で仕分ける。
    const settings = await getSettings();
    const idToken = settings.auth.idToken ?? '';
    const claims: PolicyClaims = (idToken && decodeJwtPayload(idToken)) || {};

    const patch = compileActiveSettings(masterPolicy, claims, idToken);
    await applyPolicyPatch(patch);
  } catch {
    // ネットワーク／復号／パース失敗時はローカル現状を維持する。
    return;
  }
}

/**
 * Registers the sync alarm, runs an initial sync, and wires network-recovery
 * triggers. Safe to call once at service-worker startup.
 *
 * 起動時・タイマー・オンライン復帰のいずれも {@link syncManagedPolicy} を起点に
 * する（内部で policyId 有無により組織経路 / CONSOLE_CONFIG 経路を選択）。
 */
export function initSyncManager(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void syncManagedPolicy();
  });

  // Trigger a pull on startup and whenever connectivity returns.
  void syncManagedPolicy();
  self.addEventListener('online', () => {
    void syncManagedPolicy();
  });
}
