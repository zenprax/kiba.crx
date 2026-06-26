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
import { addAuditLog, getSettings, setSettings } from '../lib/storage';
import type { KibaSettings, KibaSettingsPatch, PolicyClaims } from '../types';

/** chrome.alarms name used to schedule periodic policy pulls. */
const SYNC_ALARM = 'kiba:sync';

/** Sync interval in minutes. */
const SYNC_PERIOD_MINUTES = 30;

/**
 * 組織配信ポリシー（policy.bin / iv.txt）の取得元ベース URL。
 * Cloudflare プロキシ経由で kiba-api.zenprax.com をフロントエンドとし、
 * `${policyId}` 部分にテナント別の UUID を埋める。
 */
const POLICY_BASE_URL = 'https://kiba-api.zenprax.com/v1/users';

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
 * chrome.storage.local の `decryptionKey`（Base64 または生テキスト）を取得し、
 * SHA-256 でハッシュ化して 32 バイトの AES-GCM 鍵バッファを返す。
 *
 * ユーザーが入力した任意の文字列でも安全に 256 bit 鍵に正規化できる。
 * decryptionKey が未設定の場合は null を返し、呼び出し側で同期をスキップさせる。
 */
async function resolveRawKey(): Promise<Uint8Array<ArrayBuffer> | null> {
  const local = await chrome.storage.local.get('decryptionKey');
  if (typeof local.decryptionKey !== 'string' || local.decryptionKey.length === 0) {
    return null;
  }
  // テキスト文字列を UTF-8 バイト列にエンコードし SHA-256 で 32 バイト鍵に変換する。
  const encoded = new TextEncoder().encode(local.decryptionKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return new Uint8Array(hashBuffer) as Uint8Array<ArrayBuffer>;
}

/**
 * エンタープライズ向け：policyId をもとに暗号化マスターポリシー（policy.bin）と
 * 復号用 IV（iv.txt）を並行 fetch し、BYOK 鍵で復号して現在のユーザーの JWT
 * クレームで属性ベースにフィルタして適用する。
 *
 * 設計ポイント：
 *  - policy.bin と iv.txt を Promise.all で並行取得することで RTT を節約する。
 *  - iv.txt は Base64 エンコードされた 12 バイトの IV テキスト。
 *  - BYOK 鍵は SHA-256 でハッシュ化して 32 バイトに正規化する。
 *  - policyId が無い場合は CONSOLE_CONFIG 経路（{@link syncPolicy}）へフォールバック。
 *  - fetch／復号／パース失敗はすべて握りつぶし、ローカル現状を維持する。
 */
export async function syncManagedPolicy(): Promise<void> {
  const policyId = await resolvePolicyId();
  if (policyId === null) {
    // 組織ポリシー未指定。OSS／コンソール経路へフォールバック。
    await syncPolicy();
    return;
  }

  // decryptionKey が未設定なら同期を行わない（不完全な状態で復号試行しない）。
  const rawKey = await resolveRawKey();
  if (rawKey === null) return;

  try {
    const encodedId = encodeURIComponent(policyId);
    const policyBinUrl = `${POLICY_BASE_URL}/${encodedId}/policy.bin`;
    const ivTxtUrl = `${POLICY_BASE_URL}/${encodedId}/iv.txt`;

    // policy.bin（バイナリ）と iv.txt（プレーンテキスト Base64）を並行 fetch する。
    const [blobRes, ivRes] = await Promise.all([
      fetch(policyBinUrl, { cache: 'no-store' }),
      fetch(ivTxtUrl, { cache: 'no-store' }),
    ]);

    if (!blobRes.ok || !ivRes.ok) return;

    // iv.txt: Base64 文字列 → 12 バイトの Uint8Array に変換する。
    const ivB64 = (await ivRes.text()).trim();
    const iv = base64ToBytes(ivB64) as Uint8Array<ArrayBuffer>;

    // policy.bin: 暗号文（GCM 認証タグ含む）の ArrayBuffer。
    const ciphertext = await blobRes.arrayBuffer();
    if (ciphertext.byteLength === 0) return;

    // BYOK 鍵（SHA-256 ハッシュ済み 32 バイト）で AES-GCM 復号する。
    const masterPolicy = await decryptPolicyBlob(ciphertext, rawKey, iv);

    // 現在のユーザーの JWT クレーム（ストレージの auth.idToken）で仕分ける。
    const settings = await getSettings();
    const idToken = settings.auth.idToken ?? '';
    const claims: PolicyClaims = (idToken && decodeJwtPayload(idToken)) || {};

    const patch = compileActiveSettings(masterPolicy, claims, idToken);
    await applyPolicyPatch(patch);

    // 監査ログに同期成功を記録する。
    await addAuditLog('extension-audit', 'Policy successfully synced from Cloud', 'kiba-api.zenprax.com');
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
 *
 * 注意：online イベントは authHandler（initAuthHandler）でも購読するが、
 * ここでは alarm と起動時同期のみを担当し、online イベントは authHandler に
 * 集約して二重登録を避ける。
 */
export function initSyncManager(): void {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) return;
    void syncManagedPolicy();
  });

  // 起動時に即時 pull する。online イベントは authHandler が担当する。
  void syncManagedPolicy();
}
